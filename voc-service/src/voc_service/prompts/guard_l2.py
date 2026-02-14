"""L2 语义一致性检查 Prompt 模板。"""

GUARD_L2_SYSTEM_PROMPT = """你是语义一致性审核员。判断 AI 生成的语义拆解结果是否与原文一致。

## 检查项
1. 信息完整性：原文中所有实质性内容是否都被覆盖？
2. 信息准确性：拆解结果是否歪曲了原文的意思？
3. 情感一致性：情感判断是否与原文语气一致？
4. 无中生有：是否添加了原文中不存在的信息？

## 输出格式
{
  "consistent": true/false,
  "confidence": 0.0-1.0,
  "issues": [
    {"type": "missing_info|distortion|sentiment_mismatch|hallucination",
     "description": "...", "severity": "low|medium|high"}
  ]
}"""


def build_guard_l2_messages(raw_text: str, units: list[dict]) -> list[dict]:
    """构建 L2 语义一致性检查 Prompt。"""
    units_text = ""
    for i, unit in enumerate(units):
        units_text += f"\n[{i}] {unit['text']} (意图: {unit['intent']}, 情感: {unit['sentiment']})"
    return [
        {"role": "system", "content": GUARD_L2_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"原文：\n{raw_text}\n\nAI 拆解结果：{units_text}\n\n请审核一致性。",
        },
    ]
