"""add 2fa otp_tokens table and totp_enabled on users

Revision ID: n3e4f5a6b7c8
Revises: m2d3e4f5a6b7
Create Date: 2026-04-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "n3e4f5a6b7c8"
down_revision = "m2d3e4f5a6b7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # add the opt-in 2FA flag to the users table
    op.add_column(
        "users",
        sa.Column(
            "totp_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    # create the OTP tokens table for storing short-lived login codes
    op.create_table(
        "otp_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("code_hash", sa.String(), nullable=False),
        sa.Column("pending_token", sa.String(), nullable=False),
        sa.Column("purpose", sa.String(), nullable=False, server_default="login"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_otp_tokens_user_id", "otp_tokens", ["user_id"])
    op.create_index("ix_otp_tokens_pending_token", "otp_tokens", ["pending_token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_otp_tokens_pending_token", table_name="otp_tokens")
    op.drop_index("ix_otp_tokens_user_id", table_name="otp_tokens")
    op.drop_table("otp_tokens")
    op.drop_column("users", "totp_enabled")
