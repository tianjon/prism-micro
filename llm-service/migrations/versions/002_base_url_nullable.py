"""base_url 改为 nullable，支持内置预设 Provider。

Revision ID: 002
Revises: 001
"""

from alembic import op

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE llm.providers ALTER COLUMN base_url DROP NOT NULL")


def downgrade() -> None:
    op.execute(
        "UPDATE llm.providers SET base_url = '' WHERE base_url IS NULL"
    )
    op.execute("ALTER TABLE llm.providers ALTER COLUMN base_url SET NOT NULL")
