"""Chart highlight color palette and label→color reuse."""

from __future__ import annotations

HIGHLIGHT_PALETTE = [
    "#3C2CDA",
    "#EA9D00",
    "#14CBDE",
    "#1D86FF",
    "#12A053",
    "#DC3545",
    "#8B5CF6",
]


def color_for_label(label: str, existing: list[tuple[str, str]]) -> str:
    """Reuse color when the same label (case-insensitive) already exists."""
    needle = label.strip().lower()
    for existing_label, color in existing:
        if existing_label.strip().lower() == needle:
            return color

    distinct: list[str] = []
    seen: set[str] = set()
    for existing_label, _color in existing:
        key = existing_label.strip().lower()
        if key and key not in seen:
            seen.add(key)
            distinct.append(key)
    return HIGHLIGHT_PALETTE[len(distinct) % len(HIGHLIGHT_PALETTE)]
