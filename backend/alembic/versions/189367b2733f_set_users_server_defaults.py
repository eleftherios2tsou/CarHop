"""set users server defaults

Revision ID: 189367b2733f
Revises: 81450923c821
Create Date: 2026-02-17 13:31:33.022523

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '189367b2733f'
down_revision: Union[str, Sequence[str], None] = '81450923c821'
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
