"""add created_at to users

Revision ID: e7f3a91c8b20
Revises: 4d2a600807be
Create Date: 2026-02-18 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e7f3a91c8b20"
down_revision: Union[str, Sequence[str], None] = "4d2a600807be"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Backfill existing rows so none are NULL
    op.execute("UPDATE users SET created_at = NOW() WHERE created_at IS NULL")
    # Enforce NOT NULL with server default for future rows
    op.alter_column(
        "users",
        "created_at",
        nullable=False,
        server_default=sa.text("NOW()"),
    )


def downgrade() -> None:
    op.drop_column("users", "created_at")
