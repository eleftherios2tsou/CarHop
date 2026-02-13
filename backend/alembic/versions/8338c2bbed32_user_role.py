"""user role

Revision ID: 8338c2bbed32
Revises: 7a4b81ee6522
Create Date: 2026-02-13 16:01:13.535233

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8338c2bbed32"
down_revision: Union[str, Sequence[str], None] = "7a4b81ee6522"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    op.add_column("users", sa.Column("role", sa.String(), nullable=True))

   
    op.execute("UPDATE users SET role = 'USER'")

   
    op.execute("UPDATE users SET role = 'ADMIN' WHERE id = 1")

  
    op.alter_column("users", "role", nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("users", "role")
