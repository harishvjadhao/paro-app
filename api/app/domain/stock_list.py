from __future__ import annotations

from typing import Literal

ScreenLabel = Literal["Strong buy", "Buy", "Watch", "Avoid", "On hold"]

SCREEN_OPTIONS: list[ScreenLabel] = ["Strong buy", "Buy", "Watch", "Avoid", "On hold"]


def derive_screen(*, above_d: bool, above_w: bool, above_m: bool) -> ScreenLabel:
    count = int(above_d) + int(above_w) + int(above_m)
    if count == 3:
        return "Strong buy"
    if count == 2:
        return "Buy"
    if count == 1:
        return "Watch"
    return "Avoid"


def suggest_subcategory(industry: str, symbol: str) -> str:
    industry = (industry or "").strip()
    if not industry:
        return ""
    # Light auto-curation: keep industry stem as a starting subcategory.
    if industry.lower().endswith(" services"):
        return industry
    if " " in industry:
        return industry.split(" ")[0]
    return f"{industry} · {symbol[:3]}"
