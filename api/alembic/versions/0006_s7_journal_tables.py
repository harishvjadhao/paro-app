"""Add S7 trading journal table.

Revision ID: 0006_s7_journal_tables
Revises: 0005_s4_stock_list_tables
Create Date: 2026-08-31 22:30:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0006_s7_journal_tables"
down_revision: Union[str, None] = "0005_s4_stock_list_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "trades",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("symbol", sa.String(length=40), nullable=False),
        sa.Column("segment", sa.String(length=20), nullable=False, server_default="Delivery"),
        sa.Column("side", sa.String(length=10), nullable=False, server_default="long"),
        sa.Column("qty", sa.Float(), nullable=False),
        sa.Column("entry_price", sa.Float(), nullable=False),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("exit_price", sa.Float(), nullable=True),
        sa.Column("exit_date", sa.Date(), nullable=True),
        sa.Column("tags", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_trades_user_id", "trades", ["user_id"], unique=False)
    op.create_index("ix_trades_symbol", "trades", ["symbol"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_trades_symbol", table_name="trades")
    op.drop_index("ix_trades_user_id", table_name="trades")
    op.drop_table("trades")
