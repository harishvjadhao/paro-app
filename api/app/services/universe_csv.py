"""Pure CSV universe parsing / validation (no DB)."""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field


EXPECTED_HEADERS = ["Company Name", "Industry", "Symbol", "Series", "ISIN Code"]


@dataclass
class UniverseRow:
    company: str
    industry: str
    symbol: str
    series: str
    isin: str

    @property
    def yahoo_symbol(self) -> str:
        # Keep & (e.g. M&M → M&M.NS)
        return f"{self.symbol}.NS"


@dataclass
class UniverseParseResult:
    rows: list[UniverseRow] = field(default_factory=list)
    total: int = 0
    duplicates: int = 0
    invalid: int = 0
    invalid_messages: list[str] = field(default_factory=list)


def _norm_header(h: str) -> str:
    return h.strip().lstrip("\ufeff")


def parse_universe_csv(content: str | bytes) -> UniverseParseResult:
    if isinstance(content, bytes):
        content = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    if not reader.fieldnames:
        return UniverseParseResult(invalid=1, invalid_messages=["empty CSV"])

    headers = [_norm_header(h) for h in reader.fieldnames]
    missing = [h for h in EXPECTED_HEADERS if h not in headers]
    if missing:
        return UniverseParseResult(
            invalid=1,
            invalid_messages=[f"missing headers: {', '.join(missing)}"],
        )

    result = UniverseParseResult()
    seen: set[str] = set()
    for i, raw in enumerate(reader, start=2):
        result.total += 1
        company = (raw.get("Company Name") or "").strip()
        industry = (raw.get("Industry") or "").strip()
        symbol = (raw.get("Symbol") or "").strip().upper()
        series = (raw.get("Series") or "").strip() or "EQ"
        isin = (raw.get("ISIN Code") or "").strip()

        if not company or not industry or not symbol:
            result.invalid += 1
            result.invalid_messages.append(f"row {i}: missing company/industry/symbol")
            continue
        if symbol in seen:
            result.duplicates += 1
            continue
        seen.add(symbol)
        result.rows.append(
            UniverseRow(
                company=company,
                industry=industry,
                symbol=symbol,
                series=series,
                isin=isin,
            )
        )
    return result
