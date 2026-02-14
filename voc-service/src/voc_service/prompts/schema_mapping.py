"""Schema 映射 Prompt 模板。"""

SCHEMA_MAPPING_SYSTEM = """\
你是一个专业的数据 Schema 识别专家。你的任务是将用户上传的表格列名映射到标准化的 Voice 数据模型字段。

## 目标字段说明

### 必选字段
- `raw_text`：原始反馈文本内容（评论、工单描述、用户留言等）

### 推荐字段（映射到 metadata JSON 对象中）
- `metadata.author`：作者/用户名
- `metadata.author_id`：作者 ID
- `metadata.platform`：平台来源（如"懂车帝"、"微博"）
- `metadata.rating`：评分（数值或星级）
- `metadata.title`：标题
- `metadata.url`：原始链接
- `metadata.published_at`：发布时间
- `metadata.collected_at`：采集时间
- `metadata.category`：分类/频道
- `metadata.location`：地理位置
- `metadata.device`：设备信息
- `metadata.reply_count`：回复数
- `metadata.like_count`：点赞数

### 去重相关字段
- `source_key`：业务主键（如工单编号、评论 ID），用于按来源去重

## 输出格式

严格输出 JSON，不要添加任何其他文字：
```json
{
  "mappings": [
    {
      "source_column": "列名",
      "target_field": "raw_text 或 metadata.xxx 或 source_key",
      "confidence": 0.95,
      "reason": "简短理由"
    }
  ],
  "overall_confidence": 0.88,
  "unmapped_columns": ["未映射的列名"]
}
```

## 置信度指南
- 0.95+：列名和样本数据高度匹配（如 "评论内容" → raw_text）
- 0.85-0.95：列名语义明确（如 "content" → raw_text）
- 0.75-0.85：列名可推断（如 "text" → raw_text）
- 0.65-0.75：列名模糊但样本数据支持推断
- <0.65：无法确定映射关系，放入 unmapped_columns

## 重要规则
1. `raw_text` 是必选字段，必须找到一个最合适的列映射
2. 如果确实没有适合 raw_text 的列，overall_confidence 应 < 0.5
3. 不要强行映射不相关的列
4. 优先使用列名语义判断，样本数据作为辅助验证
"""

SCHEMA_MAPPING_USER_TEMPLATE = """\
请分析以下表格数据，将列名映射到标准 Voice 模型字段。

## 列名
{columns}

## 采样数据（前 {sample_count} 行）
{sample_data}
"""


def build_schema_mapping_messages(
    columns: list[str],
    sample_rows: list[dict[str, str]],
) -> list[dict[str, str]]:
    """构建 Schema 映射的消息列表。"""
    columns_text = "\n".join(f"- {col}" for col in columns)

    # 格式化采样数据为可读表格
    sample_lines = []
    for i, row in enumerate(sample_rows, 1):
        row_text = " | ".join(f"{k}: {v}" for k, v in row.items())
        sample_lines.append(f"第{i}行: {row_text}")
    sample_data = "\n".join(sample_lines)

    user_content = SCHEMA_MAPPING_USER_TEMPLATE.format(
        columns=columns_text,
        sample_count=len(sample_rows),
        sample_data=sample_data,
    )

    return [
        {"role": "system", "content": SCHEMA_MAPPING_SYSTEM},
        {"role": "user", "content": user_content},
    ]
