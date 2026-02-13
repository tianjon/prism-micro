"""Neo4j 最小连接层。"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import structlog
from neo4j import AsyncDriver, AsyncGraphDatabase, AsyncSession

logger = structlog.get_logger(__name__)


class Neo4jPool:
    """
    Neo4j 最小连接层。Phase 1 仅提供：
    - 连接池管理
    - Health check
    - Session 获取

    不含任何业务逻辑。Phase 2 启用知识图谱时通过 label 前缀隔离域。
    """

    def __init__(
        self,
        uri: str = "bolt://localhost:7687",
        username: str = "neo4j",
        password: str = "prism",
        max_connection_pool_size: int = 10,
        connection_acquisition_timeout: float = 30.0,
    ):
        self._uri = uri
        self._username = username
        self._password = password
        self._driver: AsyncDriver | None = None
        self._max_pool_size = max_connection_pool_size
        self._acquisition_timeout = connection_acquisition_timeout

    async def connect(self) -> None:
        """初始化连接池。应在应用启动时调用。"""
        self._driver = AsyncGraphDatabase.driver(
            self._uri,
            auth=(self._username, self._password),
            max_connection_pool_size=self._max_pool_size,
            connection_acquisition_timeout=self._acquisition_timeout,
        )
        logger.info("neo4j_pool_initialized", uri=self._uri)

    async def close(self) -> None:
        """关闭连接池。应在应用关闭时调用。"""
        if self._driver:
            await self._driver.close()
            self._driver = None
            logger.info("neo4j_pool_closed")

    async def health_check(self) -> bool:
        """
        Health check：验证 Neo4j 连接可用性。
        返回 True 表示连接正常，False 表示异常。
        """
        if not self._driver:
            return False
        try:
            await self._driver.verify_connectivity()
            return True
        except Exception as e:
            logger.warning("neo4j_health_check_failed", error=str(e))
            return False

    @asynccontextmanager
    async def get_session(self, database: str = "neo4j") -> AsyncGenerator[AsyncSession, None]:
        """获取 Neo4j session（上下文管理器）。"""
        if not self._driver:
            raise RuntimeError("Neo4j pool 未初始化，请先调用 connect()")
        async with self._driver.session(database=database) as session:
            yield session
