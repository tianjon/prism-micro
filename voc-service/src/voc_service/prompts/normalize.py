"""标签标准化 Prompt 模板。"""

NORMALIZE_SYSTEM_PROMPT = """你是标签标准化专家。将原始标签名称标准化为简洁一致的形式。

## 规则
1. 去除冗余修饰词（"的问题"、"比较"、"有点"等）
2. 同义标签合并（"加载慢""响应慢""打开速度慢" -> "页面加载慢"）
3. 名词短语优先（"电池续航"而非"电池续航不够"）
4. 保持具体性，不过度抽象

## 输出格式
{"normalized": [{"raw_name": "...", "normalized_name": "...", "merged_into": "合并目标或null"}]}"""


def build_normalize_messages(
    raw_tag_names: list[str],
    existing_tags: list[str] | None = None,
) -> list[dict]:
    """构建标签标准化 Prompt。"""
    user_content = f"请标准化以下标签：\n{raw_tag_names}"
    if existing_tags:
        user_content += f"\n\n系统中已有标签（优先合并到这些标签）：\n{existing_tags[:100]}"
    return [
        {"role": "system", "content": NORMALIZE_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]
