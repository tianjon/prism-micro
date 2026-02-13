"""内置 Provider 预设注册表。"""

from dataclasses import dataclass


@dataclass(frozen=True)
class ProviderPreset:
    """内置 LLM 平台预设配置。"""

    preset_id: str
    name: str
    provider_type: str
    base_url: str
    description: str
    test_model: str = ""  # 用于连通性 ping-pong 测试的轻量模型


BUILTIN_PRESETS: dict[str, ProviderPreset] = {
    "openrouter": ProviderPreset(
        preset_id="openrouter",
        name="OpenRouter",
        provider_type="openai",
        base_url="https://openrouter.ai/api/v1",
        description="聚合多家模型的统一 API 网关",
        test_model="openrouter/auto",
    ),
    "kimi": ProviderPreset(
        preset_id="kimi",
        name="Kimi",
        provider_type="openai",
        base_url="https://api.moonshot.cn/v1",
        description="月之暗面旗下长上下文大模型",
        test_model="moonshot-v1-8k",
    ),
    "zhipu": ProviderPreset(
        preset_id="zhipu",
        name="智谱 AI",
        provider_type="openai",
        base_url="https://open.bigmodel.cn/api/paas/v4",
        description="智谱旗下 GLM 系列大模型",
        test_model="glm-4-flash-250414",
    ),
    "aiping": ProviderPreset(
        preset_id="aiping",
        name="AIPing",
        provider_type="openai",
        base_url="https://aiping.cn/api/v1",
        description="AI Ping 大模型服务评测与 API 调用平台",
        test_model="DeepSeek-V3.2",
    ),
    "minimax": ProviderPreset(
        preset_id="minimax",
        name="MiniMax",
        provider_type="openai",
        base_url="https://api.minimaxi.com/v1",
        description="MiniMax 大模型开放平台",
        test_model="MiniMax-M2.5",
    ),
    "siliconflow": ProviderPreset(
        preset_id="siliconflow",
        name="硅基流动",
        provider_type="openai",
        base_url="https://api.siliconflow.cn/v1",
        description="硅基流动大模型推理加速平台",
        test_model="Qwen/Qwen2.5-7B-Instruct",
    ),
}


def get_preset(preset_id: str) -> ProviderPreset | None:
    """根据 preset_id 获取预设，不存在返回 None。"""
    return BUILTIN_PRESETS.get(preset_id)
