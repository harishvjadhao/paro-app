"""Add S3 workspace tables.

Revision ID: 0004_s3_workspace_tables
Revises: 0003_s2_sync_tables
Create Date: 2026-08-05 19:10:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0004_s3_workspace_tables"
down_revision: Union[str, None] = "0003_s2_sync_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "stock_states",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("symbol", sa.String(length=40), nullable=False),
        sa.Column("is_favorite", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_watchlist", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "symbol", name="uq_stock_states_user_symbol"),
    )
    op.create_index("ix_stock_states_symbol", "stock_states", ["symbol"], unique=False)

    op.create_table(
        "stock_comments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("symbol", sa.String(length=40), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_stock_comments_symbol", "stock_comments", ["symbol"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_stock_comments_symbol", table_name="stock_comments")
    op.drop_table("stock_comments")
    op.drop_index("ix_stock_states_symbol", table_name="stock_states")
    op.drop_table("stock_states")
