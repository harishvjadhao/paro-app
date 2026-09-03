"""Add S4 stock list tables.

Revision ID: 0005_s4_stock_list_tables
Revises: 0004_s3_workspace_tables
Create Date: 2026-08-31 20:20:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005_s4_stock_list_tables"
down_revision: Union[str, None] = "0004_s3_workspace_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "stock_meta",
        sa.Column("symbol", sa.String(length=40), primary_key=True),
        sa.Column("subcategory", sa.String(length=120), nullable=False, server_default=""),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("screen", sa.String(length=40), nullable=True),
        sa.Column("ma_d_override", sa.Integer(), nullable=True),
        sa.Column("ma_w_override", sa.Integer(), nullable=True),
        sa.Column("ma_m_override", sa.Integer(), nullable=True),
        sa.Column("custom_values", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "stock_list_columns",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("key", sa.String(length=80), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=False),
        sa.Column("type", sa.String(length=40), nullable=False, server_default="text"),
        sa.Column("options_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("hidden", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("user_id", sa.Integer(), nullable=False, server_default="1"),
        sa.UniqueConstraint("user_id", "key", name="uq_stock_list_columns_user_key"),
    )
    op.create_index("ix_stock_list_columns_user_id", "stock_list_columns", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_stock_list_columns_user_id", table_name="stock_list_columns")
    op.drop_table("stock_list_columns")
    op.drop_table("stock_meta")
