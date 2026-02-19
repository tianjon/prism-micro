"""Schema 映射提示词构建器。"""

from voc_service.prompts.schema_mapping import (
    SCHEMA_MAPPING_SYSTEM_V3,
    VOICE_TABLE_DDL,
)


class PromptBuilder:
    """构建 LLM Schema 映射提示词（V3：全上下文单消息）。"""

    def build_mapping_prompt(
        self,
        columns: list[str],
        total_rows: int,
        dedup_columns: list[str] | None = None,
        df_describe: str = "",
        df_info: str = "",
        sample_data: str = "",
        historical_reference: str = "",
    ) -> str:
        """填充 V3 模板占位符，返回完整提示词文本。"""
        fields_sorted = ", ".join(sorted(columns))
        primary_key = ", ".join(dedup_columns) if dedup_columns else "未指定"

        return SCHEMA_MAPPING_SYSTEM_V3.format(
            field_count=len(columns),
            row_count=total_rows,
            fields_sorted=fields_sorted,
            primary_key=primary_key,
            df_describe=df_describe,
            df_info=df_info,
            sample_count=sample_data.count("\n") + 1 if sample_data else 0,
            sample_data=sample_data,
            historical_reference=historical_reference,
            table_ddl=VOICE_TABLE_DDL,
        )

    def build_messages(
        self,
        columns: list[str],
        total_rows: int,
        dedup_columns: list[str] | None = None,
        df_describe: str = "",
        df_info: str = "",
        sample_data: str = "",
    ) -> list[dict[str, str]]:
        """构建 LLM 消息列表。V3 使用单条 user 消息。"""
        return [
            {"role": "user", "content": self.build_mapping_prompt(
                columns, total_rows,
                dedup_columns=dedup_columns,
                df_describe=df_describe,
                df_info=df_info,
                sample_data=sample_data,
            )},
        ]
