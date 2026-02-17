"""add user defaults

Revision ID: 81450923c821
Revises: c24f83caaabd
Create Date: 2026-02-17 13:15:33.397936

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "81450923c821"
down_revision: Union[str, Sequence[str], None] = "c24f83caaabd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("users", "is_active", server_default=sa.text("true"))
    op.alter_column("users", "email_verified", server_default=sa.text("false"))
    op.alter_column("users", "role", server_default=sa.text("'USER'"))


def downgrade() -> None:
    op.alter_column("users", "role", server_default=None)
    op.alter_column("users", "email_verified", server_default=None)
    op.alter_column("users", "is_active", server_default=None)
