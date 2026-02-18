"""add stripe connect fields to users

Revision ID: a8b1c3d4e5f6
Revises: f4a7d2c6b1e0
Create Date: 2026-02-18 22:40:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a8b1c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "f4a7d2c6b1e0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("stripe_account_id", sa.String(), nullable=True))
    op.add_column(
        "users",
        sa.Column("stripe_account_onboarded", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )


def downgrade() -> None:
    op.drop_column("users", "stripe_account_onboarded")
    op.drop_column("users", "stripe_account_id")
