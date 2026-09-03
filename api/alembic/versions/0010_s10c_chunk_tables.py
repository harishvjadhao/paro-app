"""Add S10c book_chunks table for RAG embeddings.

Revision ID: 0010_s10c_chunk_tables
Revises: 0009_s10b_reader_tables
Create Date: 2026-08-31 23:45:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0010_s10c_chunk_tables"
down_revision: Union[str, None] = "0009_s10b_reader_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "book_chunks",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("book_id", sa.Integer(), sa.ForeignKey("books.id", ondelete="CASCADE"), nullable=False),
        sa.Column("page_index", sa.Integer(), nullable=False),
        sa.Column("chapter", sa.String(length=240), nullable=False, server_default=""),
        sa.Column("ord", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("char_start", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("char_end", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("token_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("embedding", sa.LargeBinary(), nullable=True),
    )
    op.create_index("ix_book_chunks_book_id", "book_chunks", ["book_id"], unique=False)
    op.create_index("ix_book_chunks_book_page", "book_chunks", ["book_id", "page_index"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_book_chunks_book_page", table_name="book_chunks")
    op.drop_index("ix_book_chunks_book_id", table_name="book_chunks")
    op.drop_table("book_chunks")
