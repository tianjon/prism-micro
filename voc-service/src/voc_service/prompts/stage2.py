"""Stage 2 标签涌现 Prompt 模板。"""

STAGE2_TAGGING_SYSTEM_PROMPT = """你是一个 VOC 标签生成专家。为语义单元生成「涌现标签」。

## 什么是涌现标签？
不从预设分类中选择，而是从数据中自由发现语义主题。

## 规则
1. 每个语义单元 1-3 个标签
2. 标签具体、有信息量（"支付页面加载慢"而非"用户体验差"）
3. 第一个标签为 is_primary: true
4. 标签名 2-8 个字，不超过 20 字符
5. 标签应可跨反馈复用

## 输出格式
{
  "tagged_units": [
    {"unit_index": 0, "tags": [{"raw_name": "...", "relevance": 0.0-1.0, "is_primary": true, "confidence": 0.0-1.0}]}
  ]
}"""


def build_stage2_tagging_messages(units: list[dict]) -> list[dict]:
    """构建 Stage 2 标签涌现 Prompt。"""
    units_text = ""
    for i, unit in enumerate(units):
        units_text += (
            f"\n[{i}] 文本: {unit['text']}"
            f"\n    摘要: {unit['summary']}"
            f"\n    意图: {unit['intent']}"
            f"\n    情感: {unit['sentiment']}\n"
        )

    return [
        {"role": "system", "content": STAGE2_TAGGING_SYSTEM_PROMPT},
        {"role": "user", "content": f"请为以下语义单元生成涌现标签：\n{units_text}"},
    ]
