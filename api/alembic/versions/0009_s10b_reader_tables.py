"""Add S10b reader tables (progress, bookmarks, highlights).

Revision ID: 0009_s10b_reader_tables
Revises: 0008_s10a_library_tables
Create Date: 2026-08-31 23:30:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0009_s10b_reader_tables"
down_revision: Union[str, None] = "0008_s10a_library_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "reading_progress",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("book_id", sa.Integer(), sa.ForeignKey("books.id", ondelete="CASCADE"), nullable=False),
        sa.Column("page_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "book_id", name="uq_reading_progress_user_book"),
    )
    op.create_index("ix_reading_progress_book_id", "reading_progress", ["book_id"], unique=False)

    op.create_table(
        "book_bookmarks",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("book_id", sa.Integer(), sa.ForeignKey("books.id", ondelete="CASCADE"), nullable=False),
        sa.Column("page_index", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=240), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "book_id", "page_index", name="uq_book_bookmarks_user_book_page"),
    )
    op.create_index("ix_book_bookmarks_book_id", "book_bookmarks", ["book_id"], unique=False)

    op.create_table(
        "book_highlights",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("book_id", sa.Integer(), sa.ForeignKey("books.id", ondelete="CASCADE"), nullable=False),
        sa.Column("page_index", sa.Integer(), nullable=False),
        sa.Column("start_offset", sa.Integer(), nullable=False),
        sa.Column("end_offset", sa.Integer(), nullable=False),
        sa.Column("quote", sa.Text(), nullable=False),
        sa.Column("color", sa.String(length=20), nullable=False, server_default="#EA9D00"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_book_highlights_book_id", "book_highlights", ["book_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_book_highlights_book_id", table_name="book_highlights")
    op.drop_table("book_highlights")
    op.drop_index("ix_book_bookmarks_book_id", table_name="book_bookmarks")
    op.drop_table("book_bookmarks")
    op.drop_index("ix_reading_progress_book_id", table_name="reading_progress")
    op.drop_table("reading_progress")
