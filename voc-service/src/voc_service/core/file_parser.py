"""CSV/Excel 文件解析器。"""

import csv
import io
from dataclasses import dataclass

import chardet
from fastapi import UploadFile

from prism_shared.exceptions import AppException


@dataclass
class ParseResult:
    """文件解析结果。"""

    rows: list[dict[str, str]]
    columns: list[str]
    total_rows: int
    file_size_bytes: int
    detected_encoding: str
    detected_format: str


def _detect_encoding(raw_bytes: bytes) -> str:
    """自动检测文件编码。"""
    result = chardet.detect(raw_bytes)
    encoding = result.get("encoding")
    if not encoding:
        raise AppException(
            code="VOC_FILE_ENCODING_ERROR",
            message="无法识别文件编码",
            status_code=400,
        )
    # chardet 有时返回 GB2312，统一映射为 GBK（超集）
    normalized = encoding.lower()
    if normalized in ("gb2312", "gbk", "gb18030"):
        return "gbk"
    return normalized


def _parse_csv_bytes(raw_bytes: bytes, *, sample_only: bool, sample_rows: int) -> ParseResult:
    """解析 CSV 字节流。"""
    encoding = _detect_encoding(raw_bytes)
    try:
        text = raw_bytes.decode(encoding)
    except (UnicodeDecodeError, LookupError) as e:
        raise AppException(
            code="VOC_FILE_ENCODING_ERROR",
            message=f"使用 {encoding} 编码解码失败：{e}",
            status_code=400,
        ) from e

    # 去除 BOM
    if text.startswith("\ufeff"):
        text = text[1:]

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise AppException(
            code="VOC_EMPTY_FILE",
            message="CSV 文件为空或缺少表头",
            status_code=400,
        )

    columns = list(reader.fieldnames)
    rows: list[dict[str, str]] = []
    for i, row in enumerate(reader):
        if sample_only and i >= sample_rows:
            break
        rows.append(row)

    # 如果是采样模式，总行数需要继续计数
    total_rows = len(rows)
    if sample_only and total_rows >= sample_rows:
        for _ in reader:
            total_rows += 1

    return ParseResult(
        rows=rows,
        columns=columns,
        total_rows=total_rows,
        file_size_bytes=len(raw_bytes),
        detected_encoding=encoding,
        detected_format="csv",
    )


def _parse_excel_bytes(raw_bytes: bytes, *, sample_only: bool, sample_rows: int) -> ParseResult:
    """解析 Excel 字节流。"""
    from openpyxl import load_workbook

    wb = load_workbook(io.BytesIO(raw_bytes), data_only=True, read_only=True)
    try:
        ws = wb.active
        if ws is None:
            raise AppException(
                code="VOC_EMPTY_FILE",
                message="Excel 文件没有活动工作表",
                status_code=400,
            )

        row_iter = ws.iter_rows(values_only=True)
        # 第一行作为表头
        try:
            header_row = next(row_iter)
        except StopIteration as e:
            raise AppException(
                code="VOC_EMPTY_FILE",
                message="Excel 文件为空",
                status_code=400,
            ) from e

        columns = [str(c).strip() if c is not None else f"column_{i}" for i, c in enumerate(header_row)]
        if not any(c for c in columns if not c.startswith("column_")):
            raise AppException(
                code="VOC_EMPTY_FILE",
                message="Excel 文件表头为空",
                status_code=400,
            )

        rows: list[dict[str, str]] = []
        total_rows = 0
        for row_values in row_iter:
            total_rows += 1
            if sample_only and len(rows) >= sample_rows:
                continue  # 继续计数但不添加行
            row_dict = {}
            for j, val in enumerate(row_values):
                if j < len(columns):
                    row_dict[columns[j]] = str(val) if val is not None else ""
            rows.append(row_dict)
    finally:
        wb.close()

    return ParseResult(
        rows=rows,
        columns=columns,
        total_rows=total_rows,
        file_size_bytes=len(raw_bytes),
        detected_encoding="utf-8",
        detected_format="excel",
    )


_ALLOWED_EXTENSIONS = {
    ".csv": "csv",
    ".xlsx": "excel",
}


async def parse_file(
    file: UploadFile,
    *,
    max_file_size_bytes: int = 52_428_800,
    sample_only: bool = False,
    sample_rows: int = 10,
) -> ParseResult:
    """
    统一入口：根据扩展名分派到 CSV/Excel 解析器。

    Args:
        file: FastAPI UploadFile 对象
        max_file_size_bytes: 最大文件大小限制
        sample_only: 是否只返回采样数据
        sample_rows: 采样行数
    """
    filename = file.filename or ""
    ext = ""
    dot_idx = filename.rfind(".")
    if dot_idx >= 0:
        ext = filename[dot_idx:].lower()

    file_type = _ALLOWED_EXTENSIONS.get(ext)
    if not file_type:
        raise AppException(
            code="VOC_INVALID_FILE_FORMAT",
            message=f"不支持的文件格式 '{ext}'，仅支持 .csv / .xlsx",
            status_code=400,
        )

    raw_bytes = await file.read()
    if not raw_bytes:
        raise AppException(
            code="VOC_EMPTY_FILE",
            message="上传文件为空",
            status_code=400,
        )

    if len(raw_bytes) > max_file_size_bytes:
        raise AppException(
            code="VOC_FILE_TOO_LARGE",
            message=f"文件大小 {len(raw_bytes)} 字节超过限制 {max_file_size_bytes} 字节",
            status_code=400,
        )

    if file_type == "csv":
        return _parse_csv_bytes(raw_bytes, sample_only=sample_only, sample_rows=sample_rows)
    return _parse_excel_bytes(raw_bytes, sample_only=sample_only, sample_rows=sample_rows)
