"""日志查询命令。"""

import json

import httpx
import typer
from rich.console import Console
from rich.text import Text

app = typer.Typer(name="logs", help="查询后端日志")
console = Console()

LEVEL_COLORS: dict[str, str] = {
    "error": "red",
    "warning": "yellow",
    "info": "white",
    "debug": "dim",
}


@app.callback(invoke_without_command=True)
def logs(
    service: str | None = typer.Option(None, "--service", "-s", help="按服务筛选"),
    module: str | None = typer.Option(None, "--module", "-m", help="按模块筛选"),
    level: str | None = typer.Option(None, "--level", "-l", help="按级别筛选（debug/info/warning/error）"),
    since: str | None = typer.Option(None, "--since", help="起始时间（ISO 8601）"),
    until: str | None = typer.Option(None, "--until", help="结束时间（ISO 8601）"),
    tail: int = typer.Option(20, "--tail", "-n", help="显示最近 N 条日志"),
    output_format: str = typer.Option("text", "--format", "-f", help="输出格式（text/json）"),
    api_url: str | None = typer.Option(None, "--api-url", envvar="PRISM_API_URL", help="后端 API 地址"),
    token: str | None = typer.Option(None, "--token", "-t", envvar="PRISM_TOKEN", help="JWT 认证 token"),
) -> None:
    """查询后端日志。"""
    base_url = api_url or "http://prism.test:8601"

    # 构建查询参数
    params: dict[str, str | int] = {"page": 1, "page_size": tail}
    if service:
        params["service"] = service
    if module:
        params["module"] = module
    if level:
        params["level"] = level
    if since:
        params["since"] = since
    if until:
        params["until"] = until

    # 构建请求头
    headers: dict[str, str] = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        response = httpx.get(
            f"{base_url}/api/platform/logs",
            params=params,
            headers=headers,
            timeout=10,
        )
    except httpx.ConnectError:
        console.print(f"[red]无法连接到 {base_url}，请确认后端服务是否运行[/red]")
        raise typer.Exit(code=1) from None

    if response.status_code == 401:
        console.print("[red]认证失败：请通过 --token 或 PRISM_TOKEN 环境变量提供 JWT token[/red]")
        raise typer.Exit(code=1)

    if response.status_code != 200:
        console.print(f"[red]查询失败（HTTP {response.status_code}）：{response.text}[/red]")
        raise typer.Exit(code=1)

    data = response.json()
    entries: list[dict] = data.get("data", [])

    if not entries:
        console.print("[dim]未找到匹配的日志条目[/dim]")
        raise typer.Exit(code=0)

    # 输出
    if output_format == "json":
        for entry in entries:
            print(json.dumps(entry, ensure_ascii=False))  # noqa: T201
    else:
        _print_text(entries)


def _print_text(entries: list[dict]) -> None:
    """以可读文本格式输出日志条目。"""
    for entry in entries:
        ts = entry.get("timestamp", "")[:19]  # 截取到秒
        lvl = entry.get("level", "info").lower()
        svc = entry.get("service", "-")
        mod = entry.get("module", "-")
        msg = entry.get("event", "")

        color = LEVEL_COLORS.get(lvl, "white")
        line = Text()
        line.append(f"[{ts}] ", style="dim")
        line.append(f"[{lvl.upper():7s}] ", style=color)
        line.append(f"[{svc}/{mod}] ", style="cyan")
        line.append(msg)
        console.print(line)
