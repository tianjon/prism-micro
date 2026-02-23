"""agent-service 配置。"""

from pydantic import Field

from prism_shared.config import BaseAppSettings


class AgentServiceSettings(BaseAppSettings):
    """Agent 服务配置。"""

    llm_service_base_url: str = Field(default="http://127.0.0.1:8601", description="llm-service 基础地址")
    default_slot: str = Field(default="reasoning", description="默认推理槽位")
    max_steps: int = Field(default=3, description="单次执行最大步骤数")
