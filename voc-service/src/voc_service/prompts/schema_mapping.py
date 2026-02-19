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


# ==================== v2 模板（全覆盖映射） ====================

SCHEMA_MAPPING_SYSTEM_V2 = """\
你是一个专业的数据 Schema 映射专家。你的任务是将用户上传的表格列名映射到标准化的 Voice 数据模型字段。

## 目标表 Schema：voc.voices

| 字段 | 映射键 | 类型 | 必填 | 说明 |
|------|--------|------|------|------|
| 原始文本 | raw_text | TEXT | 是 | 主要反馈内容（评论/工单/用户留言），必须映射 |
| 业务标识 | source_key | VARCHAR(200) | 否 | 业务唯一标识（工单号/评论 ID），用于按来源去重 |
| 元数据 | metadata.* | JSONB 子字段 | 否 | 结构化属性，见下方明细 |

### metadata JSONB 结构

| 子字段 | 映射键 | 值类型 | 说明 |
|--------|--------|--------|------|
| 标题 | metadata.title | string | 标题 |
| 作者 | metadata.author | string | 作者/用户名 |
| 作者 ID | metadata.author_id | string | 作者唯一标识 |
| 平台 | metadata.platform | string | 平台来源（如"懂车帝"、"微博"） |
| 评分 | metadata.rating | number | 评分（数值或星级） |
| 分类 | metadata.category | string | 分类/频道 |
| 产品名称 | metadata.product_name | string | 产品名称（VOC-产品关联） |
| SKU | metadata.sku | string | SKU 编码（VOC-产品关联） |
| 链接 | metadata.url | string | 原始链接 |
| 发布时间 | metadata.published_at | string | 发布时间（ISO 8601） |
| 采集时间 | metadata.collected_at | string | 采集时间（ISO 8601） |
| 地理位置 | metadata.location | string | 地理位置 |
| 设备 | metadata.device | string | 设备信息 |
| 回复数 | metadata.reply_count | number | 回复数 |
| 点赞数 | metadata.like_count | number | 点赞数 |

## 全覆盖规则（零遗漏）

1. 源文件的**每一列**都必须出现在 mappings 数组中
2. 匹配到预定义字段的列 → 映射到对应键（如 raw_text, metadata.author）
3. 无法匹配的列 → 映射到 `metadata.ext_{原始列名小写}`
4. ext_ 前缀标识扩展字段，存储在 metadata JSONB 中，保证零数据丢失
5. unmapped_columns 输出**必须为空数组** []
6. 验证：len(mappings) 必须等于源文件列数

## 推理步骤（Chain of Thought）

请按以下步骤逐一分析，在 JSON 输出前先在 "reasoning" 字段中记录你的思考过程：

1. **数据类型识别**：这是什么类型的数据？（客户评论、工单、社交媒体？）
2. **主文本定位**：哪一列最可能是用户反馈的主体文本？根据列名语义 + 样本内容 + 统计信息判断
3. **业务键识别**：是否有唯一标识列？（ID、编号、序号等）
4. **结构化字段匹配**：逐列与 metadata 预定义字段进行语义匹配
5. **剩余列处理**：将未匹配的列分配到 metadata.ext_* 扩展字段
6. **覆盖性验证**：确认所有源列都已映射，unmapped_columns 为空

## 输出格式（严格 JSON）

```json
{
  "reasoning": "逐步分析过程...",
  "mappings": [
    {
      "source_column": "列名",
      "target_field": "raw_text|source_key|metadata.xxx|metadata.ext_xxx",
      "confidence": 0.95,
      "reason": "简短理由"
    }
  ],
  "overall_confidence": 0.88,
  "unmapped_columns": []
}
```

## 置信度指南
- 0.95+：列名和样本数据高度匹配（如 "评论内容" → raw_text）
- 0.85-0.95：列名语义明确（如 "content" → raw_text）
- 0.75-0.85：列名可推断（如 "text" → raw_text）
- 0.65-0.75：列名模糊但样本数据支持推断
- ext_ 扩展字段统一使用 0.60 置信度

## 重要规则
1. raw_text 是必选字段，必须找到一个最合适的列映射
2. 如果确实没有适合 raw_text 的列，overall_confidence 应 < 0.5
3. 优先使用列名语义判断，样本数据和统计信息作为辅助验证
4. 所有列都必须有映射目标，无法识别的列使用 metadata.ext_{原始列名小写}
"""

# ==================== v3 模板（全上下文单消息） ====================

VOICE_TABLE_DDL = """\
CREATE TABLE voc.voices (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source        VARCHAR(50)  NOT NULL,  -- 数据来源标识
    raw_text      TEXT         NOT NULL,  -- 原始反馈文本（必须映射）
    content_hash  VARCHAR(64)  NOT NULL,  -- SHA-256(raw_text)，无 source_key 时用于去重
    source_key    VARCHAR(200),           -- 业务主键（工单号/评论 ID），按 (source, source_key) 去重
    batch_id      UUID REFERENCES voc.ingestion_batches(id),
    processed_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    metadata      JSONB NOT NULL DEFAULT '{}',
    -- metadata 预定义子字段：
    --   title        TEXT     标题
    --   author       TEXT     作者/用户名
    --   author_id    TEXT     作者唯一标识
    --   platform     TEXT     平台来源（懂车帝、微博…）
    --   rating       NUMERIC  评分
    --   category     TEXT     分类/频道
    --   product_name TEXT     产品名称
    --   sku          TEXT     SKU 编码
    --   url          TEXT     原始链接
    --   published_at TEXT     发布时间（ISO 8601）
    --   collected_at TEXT     采集时间（ISO 8601）
    --   location     TEXT     地理位置
    --   device       TEXT     设备信息
    --   reply_count  INTEGER  回复数
    --   like_count   INTEGER  点赞数
    --   ext_*        ANY      扩展字段（无法匹配预定义字段的列存入此处）
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);"""

SCHEMA_MAPPING_SYSTEM_V3 = """\
## 角色
你是 VOC 数据分析专家，需要充分理解**原始数据**各字段的业务含义，并建立原始数据与 VOC 数据结构之间的映射关系。

## 原始数据

### Summary
原始数据共 {field_count} 个字段，{row_count} 行。
字段名（升序）：{fields_sorted}
用户指定主键列：{primary_key}

### Description（pandas DataFrame.describe()）
```
{df_describe}
```

### Info（pandas DataFrame.info()）
```
{df_info}
```

### 数据取样（随机采样 {sample_count} 行）
```
{sample_data}
```

{historical_reference}

## 目标数据结构
```sql
{table_ddl}
```

## 约束
- 你的回复必须是且仅是一个合法 JSON 对象，禁止包含 markdown 代码块标记（```）、注释或任何非 JSON 文本
- ext_ 扩展字段名必须为英文小写 + 下划线，禁止使用中文（如 ext_车系名 是错误的，应为 ext_car_series）
- reason 字段用一句话概括，不要展开分析

## 工作步骤
1. 结合样本数据，理解原始数据中各列的业务含义和分布特点
2. 推测所属行业及用户声音的重要维度
3. 识别分类字段、用户标识字段、产品/服务标识字段
4. 原始数据的**每个字段**都必须存储在目标表中：
   - 匹配预定义字段 → 映射到 raw_text / source_key / metadata.xxx
   - 无法匹配 → 存入 metadata.ext_{{english_name}}（ext_ 后必须使用英文命名，如中文列"车系名"→ metadata.ext_car_series）
5. 验证映射完整性：mappings 数组长度必须等于原始字段数，unmapped_columns 为空数组

## 输出格式
{{
  "mappings": [
    {{
      "source_column": "列名",
      "target_field": "raw_text|source_key|metadata.xxx|metadata.ext_xxx",
      "confidence": 0.95,
      "reason": "简短理由"
    }}
  ],
  "overall_confidence": 0.88,
  "unmapped_columns": []
}}

## 置信度指南
- 0.95+：列名和样本数据高度匹配（如"评论内容" → raw_text）
- 0.85-0.95：列名语义明确（如"content" → raw_text）
- 0.75-0.85：列名可推断（如"text" → raw_text）
- 0.65-0.75：列名模糊但样本数据支持推断
- ext_ 扩展字段统一使用 0.60 置信度
"""
