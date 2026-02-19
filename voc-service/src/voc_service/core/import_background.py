"""后台导入任务：独立 DB session，不复用请求 scope session。"""

import contextlib
import tempfile
import time
from pathlib import Path
from uuid import UUID

import structlog

from voc_service.core import import_service, schema_mapping_service
from voc_service.core.file_parser import parse_bytes
from voc_service.core.llm_client import LLMClient
from voc_service.models.enums import BatchStatus

logger = structlog.get_logger(__name__)


def _ms(start: float) -> int:
    """计算自 start 以来经过的毫秒数。"""
    return int((time.monotonic() - start) * 1000)


def _temp_file_path(batch_id: UUID) -> Path:
    """返回暂存文件路径。"""
    return Path(tempfile.gettempdir()) / f"prism-import-{batch_id}"


async def run_generate_mapping_background(
    session_factory,
    *,
    batch_id: UUID,
    llm_base_url: str,
    llm_timeout: int,
    api_key: str | None,
    confidence_auto: float,
    max_file_size_bytes: int,
    mapping_sample_rows: int,
) -> None:
    """后台执行 LLM 映射生成（使用已存储的 prompt_text）。"""
    try:
        async with session_factory() as db:
            try:
                t0 = time.monotonic()
                batch = await import_service.get_batch_with_progress(db, batch_id=batch_id)

                # 1. 使用已存储的 prompt_text（V3 模板包含完整上下文，用户可能已编辑）
                user_prompt = batch.prompt_text
                if not user_prompt:
                    raise ValueError("prompt_text 为空，请先调用 build-prompt 构建提示词")

                messages = [
                    {"role": "user", "content": user_prompt},
                ]
                logger.info("映射后台步骤耗时", step="prepare_messages", batch_id=str(batch_id), elapsed_ms=_ms(t0))

                # 2. 读取暂存文件获取列信息（用于创建 SchemaMapping 记录）
                t1 = time.monotonic()
                temp_path = _temp_file_path(batch_id)
                if not temp_path.exists():
                    raise FileNotFoundError(f"暂存文件不存在：{temp_path}")

                file_bytes = temp_path.read_bytes()
                filename = batch.file_name or "unknown"

                sample_result = parse_bytes(
                    file_bytes,
                    filename=filename,
                    max_file_size_bytes=max_file_size_bytes,
                    sample_only=True,
                    sample_rows=mapping_sample_rows,
                )
                logger.info("映射后台步骤耗时", step="read_and_parse", batch_id=str(batch_id), elapsed_ms=_ms(t1))

                # 3. 调用 LLM
                t2 = time.monotonic()
                llm_client = LLMClient(base_url=llm_base_url, timeout=llm_timeout)
                llm_response = await llm_client.invoke_slot(
                    slot="reasoning",
                    messages=messages,
                    temperature=0.1,
                    max_tokens=8192,
                    api_key=api_key,
                )
                logger.info("映射后台步骤耗时", step="llm_invoke", batch_id=str(batch_id), elapsed_ms=_ms(t2))

                # 4. 解析响应并创建映射
                t3 = time.monotonic()
                mapping_result = await schema_mapping_service.create_mapping_from_llm_response(
                    db,
                    llm_response=llm_response,
                    columns=sample_result.columns,
                    sample_rows=sample_result.rows,
                    source_format=sample_result.detected_format,
                    confidence_auto=confidence_auto,
                )
                logger.info("映射后台步骤耗时", step="create_mapping", batch_id=str(batch_id), elapsed_ms=_ms(t3))

                batch.mapping_id = mapping_result.mapping.id
                batch.status = BatchStatus.MAPPING
                await db.commit()

                logger.info(
                    "映射生成完成，等待用户确认",
                    batch_id=str(batch_id),
                    confidence=mapping_result.mapping.confidence,
                    is_new=mapping_result.is_new,
                    total_elapsed_ms=_ms(t0),
                )

            except Exception as e:
                logger.error(
                    "后台映射生成失败",
                    batch_id=str(batch_id),
                    error_type=type(e).__name__,
                    error=str(e),
                    exc_info=True,
                )
                await db.rollback()
                try:
                    async with session_factory() as err_db:
                        err_batch = await import_service.get_batch_with_progress(err_db, batch_id=batch_id)
                        err_batch.status = BatchStatus.FAILED
                        err_batch.error_message = f"{type(e).__name__}: {e}"
                        await err_db.commit()
                    logger.info("批次错误状态已持久化", batch_id=str(batch_id))
                except Exception as recovery_err:
                    logger.error(
                        "错误恢复失败：无法更新批次状态",
                        batch_id=str(batch_id),
                        original_error=str(e),
                        recovery_error=str(recovery_err),
                        exc_info=True,
                    )

    except Exception as e:
        logger.error(
            "后台映射任务异常（session 层）",
            batch_id=str(batch_id),
            error_type=type(e).__name__,
            error=str(e),
            exc_info=True,
        )


async def run_confirm_import_background(
    session_factory,
    *,
    batch_id: UUID,
    mapping_id: UUID,
    max_file_size_bytes: int,
    chunk_size: int,
) -> None:
    """后台执行确认后的导入。"""
    temp_path = _temp_file_path(batch_id)
    try:
        async with session_factory() as db:
            try:
                t0 = time.monotonic()

                # 1. 读取暂存文件
                # TODO: 大文件风险 — 当前将整个文件读入内存，50MB+ 数据会显著占用内存。
                # 后续应改为流式/分块解析（chunked parsing + batch insert）。
                t1 = time.monotonic()
                if not temp_path.exists():
                    raise FileNotFoundError(f"暂存文件不存在：{temp_path}")
                file_bytes = temp_path.read_bytes()

                batch = await import_service.get_batch_with_progress(db, batch_id=batch_id)
                filename = batch.file_name or "unknown"
                logger.info("导入后台步骤耗时", step="read_temp_file", batch_id=str(batch_id), elapsed_ms=_ms(t1))

                # 2. 完整解析
                t2 = time.monotonic()
                full_result = parse_bytes(
                    file_bytes,
                    filename=filename,
                    max_file_size_bytes=max_file_size_bytes,
                    sample_only=False,
                )
                batch.total_count = full_result.total_rows
                logger.info("导入后台步骤耗时", step="full_parse", batch_id=str(batch_id), elapsed_ms=_ms(t2), total_rows=full_result.total_rows)

                # 3. 获取映射
                from sqlalchemy import select

                from voc_service.models.schema_mapping import SchemaMapping

                stmt = select(SchemaMapping).where(SchemaMapping.id == mapping_id)
                result = await db.execute(stmt)
                mapping = result.scalar_one()

                # 4. 执行导入
                t4 = time.monotonic()
                await import_service.execute_import(
                    db,
                    batch=batch,
                    rows=full_result.rows,
                    mapping=mapping,
                    chunk_size=chunk_size,
                    dedup_columns=batch.dedup_columns,
                )
                await db.commit()
                logger.info("导入后台步骤耗时", step="execute_import", batch_id=str(batch_id), elapsed_ms=_ms(t4))
                logger.info("导入完成", batch_id=str(batch_id), total_elapsed_ms=_ms(t0))

            except Exception as e:
                logger.error(
                    "后台确认导入失败",
                    batch_id=str(batch_id),
                    error_type=type(e).__name__,
                    error=str(e),
                    exc_info=True,
                )
                await db.rollback()
                try:
                    async with session_factory() as err_db:
                        err_batch = await import_service.get_batch_with_progress(err_db, batch_id=batch_id)
                        err_batch.status = BatchStatus.FAILED
                        err_batch.error_message = f"{type(e).__name__}: {e}"
                        await err_db.commit()
                    logger.info("批次错误状态已持久化", batch_id=str(batch_id))
                except Exception as recovery_err:
                    logger.error(
                        "错误恢复失败：无法更新批次状态",
                        batch_id=str(batch_id),
                        original_error=str(e),
                        recovery_error=str(recovery_err),
                        exc_info=True,
                    )

    except Exception as e:
        logger.error(
            "后台确认导入异常（session 层）",
            batch_id=str(batch_id),
            error_type=type(e).__name__,
            error=str(e),
            exc_info=True,
        )
    finally:
        # 清理临时文件
        if temp_path.exists():
            with contextlib.suppress(OSError):
                temp_path.unlink()
