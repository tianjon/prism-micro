"""Prism CLI 工具。"""

import typer

__version__ = "0.1.0"

app = typer.Typer(
    name="prism",
    help="Prism 平台命令行工具",
    no_args_is_help=True,
)


def _register_commands() -> None:
    """注册所有子命令。"""
    from prism_cli.commands import logs

    app.add_typer(logs.app)


_register_commands()
