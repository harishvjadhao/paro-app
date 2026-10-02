"""S0 foundation baseline.

Revision ID: 0001_s0_foundation
Revises:
Create Date: 2026-08-05 15:35:00
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001_s0_foundation"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Initial revision is intentionally empty.
    pass


def downgrade() -> None:
    pass
