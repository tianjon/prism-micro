"""user-service 配置。"""

from prism_shared.config.base import BaseAppSettings


class UserServiceSettings(BaseAppSettings):
    """用户认证服务配置。"""

    app_name: str = "user-service"

    # 用户注册配置
    default_user_role: str = "user"
    allow_registration: bool = True
