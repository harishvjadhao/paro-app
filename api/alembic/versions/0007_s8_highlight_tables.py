"""Add S8 chart highlights table.

Revision ID: 0007_s8_highlight_tables
Revises: 0006_s7_journal_tables
Create Date: 2026-08-31 22:50:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0007_s8_highlight_tables"
down_revision: Union[str, None] = "0006_s7_journal_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "chart_highlights",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("label", sa.String(length=120), nullable=False),
        sa.Column("color", sa.String(length=20), nullable=False),
        sa.Column("symbol", sa.String(length=40), nullable=True),
        sa.Column("date_from", sa.Date(), nullable=False),
        sa.Column("date_to", sa.Date(), nullable=False),
        sa.UniqueConstraint("label", "date_from", "date_to", "symbol", name="uq_chart_highlights_label_range_symbol"),
    )
    op.create_index("ix_chart_highlights_label", "chart_highlights", ["label"], unique=False)
    op.create_index("ix_chart_highlights_symbol", "chart_highlights", ["symbol"], unique=False)
    op.create_index("ix_chart_highlights_date_from", "chart_highlights", ["date_from"], unique=False)
    op.create_index("ix_chart_highlights_date_to", "chart_highlights", ["date_to"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_chart_highlights_date_to", table_name="chart_highlights")
    op.drop_index("ix_chart_highlights_date_from", table_name="chart_highlights")
    op.drop_index("ix_chart_highlights_symbol", table_name="chart_highlights")
    op.drop_index("ix_chart_highlights_label", table_name="chart_highlights")
    op.drop_table("chart_highlights")
