"""add review_type and target_user_id to reviews

Revision ID: h7e8f9a0b1c2
Revises: g6d7e8f9a0b1
Create Date: 2026-02-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "h7e8f9a0b1c2"
down_revision = "g6d7e8f9a0b1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the old unique index on booking_id alone
    op.drop_index("ix_reviews_booking_id", table_name="reviews")

    # Add new columns
    op.add_column(
        "reviews",
        sa.Column("review_type", sa.String(), nullable=False, server_default="CAR_REVIEW"),
    )
    op.add_column(
        "reviews",
        sa.Column(
            "target_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # Re-create booking_id index as non-unique
    op.create_index("ix_reviews_booking_id", "reviews", ["booking_id"], unique=False)

    # New composite unique constraint: one review of each type per booking
    op.create_unique_constraint(
        "uq_reviews_booking_review_type", "reviews", ["booking_id", "review_type"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_reviews_booking_review_type", "reviews", type_="unique")
    op.drop_index("ix_reviews_booking_id", table_name="reviews")
    op.drop_column("reviews", "target_user_id")
    op.drop_column("reviews", "review_type")
    # Restore original unique index on booking_id
    op.create_index("ix_reviews_booking_id", "reviews", ["booking_id"], unique=True)
