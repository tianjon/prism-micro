"""Stage 1 语义拆解 Prompt 模板。"""

STAGE1_SYSTEM_PROMPT = """你是一个语义分析专家，擅长从客户反馈中提取结构化的语义单元。

## 任务
将一条客户反馈文本拆解为多个独立的「语义单元」。每个语义单元表达一个完整的独立观点或诉求。

## 语义单元结构
- text: 原文中对应的文本片段
- summary: 一句话摘要（不超过 50 字）
- intent: 用户意图（complaint/suggestion/praise/inquiry/comparison/experience 等）
- sentiment: 情感倾向（positive/negative/neutral/mixed）
- confidence: 置信度（0.0-1.0）

## 规则
1. 一条反馈拆解为 1-10 个语义单元
2. 每个语义单元必须独立可理解
3. 不要遗漏信息
4. 纯寒暄/语气词可忽略
5. 如果原文只表达一个观点，输出 1 个语义单元

## 输出格式
严格输出 JSON：
{
  "units": [
    {"text": "...", "summary": "...", "intent": "...", "sentiment": "...", "confidence": 0.0-1.0}
  ]
}"""

STAGE1_SIMPLIFIED_SYSTEM_PROMPT = (
    "你是语义分析专家。将客户反馈拆解为语义单元。\n"
    '输出 JSON：{"units": [{"text": "...", "summary": "...", "intent": "...",'
    ' "sentiment": "positive|negative|neutral|mixed", "confidence": 0.0-1.0}]}'
)


def build_stage1_messages(raw_text: str) -> list[dict]:
    """构建 Stage 1 语义拆解 Prompt。"""
    return [
        {"role": "system", "content": STAGE1_SYSTEM_PROMPT},
        {"role": "user", "content": f"请拆解以下客户反馈：\n\n{raw_text}"},
    ]


def build_stage1_simplified_messages(raw_text: str) -> list[dict]:
    """降级用简化 Prompt。"""
    return [
        {"role": "system", "content": STAGE1_SIMPLIFIED_SYSTEM_PROMPT},
        {"role": "user", "content": raw_text},
    ]
