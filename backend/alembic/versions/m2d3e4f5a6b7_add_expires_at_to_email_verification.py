"""add expires_at to email_verification_tokens

Revision ID: m2d3e4f5a6b7
Revises: l1c2d3e4f5a6
Create Date: 2026-02-25 00:00:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "m2d3e4f5a6b7"
down_revision = "l1c2d3e4f5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "email_verification_tokens",
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("email_verification_tokens", "expires_at")
