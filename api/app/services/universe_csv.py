from __future__ import annotations

import csv
import io
from dataclasses import dataclass

REQUIRED_HEADERS = ["Company Name", "Industry", "Symbol", "Series", "ISIN Code"]


@dataclass(frozen=True)
class ParsedUniverseRow:
    symbol: str
    company: str
    industry: str
    series: str
    isin: str
    yahoo_symbol: str


@dataclass(frozen=True)
class ParsedUniverseCSV:
    total: int
    invalid: int
    rows: list[ParsedUniverseRow]


def parse_universe_csv(content: bytes) -> ParsedUniverseCSV:
    decoded = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(decoded))

    if reader.fieldnames is None:
        raise ValueError("CSV has no header row.")

    missing = [name for name in REQUIRED_HEADERS if name not in reader.fieldnames]
    if missing:
        missing_text = ", ".join(missing)
        raise ValueError(f"Missing required column(s): {missing_text}. No changes were applied.")

    total = 0
    invalid = 0
    rows: list[ParsedUniverseRow] = []

    for raw in reader:
        total += 1
        company = (raw.get("Company Name") or "").strip()
        industry = (raw.get("Industry") or "").strip()
        symbol = (raw.get("Symbol") or "").strip().upper()
        series = (raw.get("Series") or "").strip()
        isin = (raw.get("ISIN Code") or "").strip()

        if not (company and industry and symbol and series and isin):
            invalid += 1
            continue

        rows.append(
            ParsedUniverseRow(
                symbol=symbol,
                company=company,
                industry=industry,
                series=series,
                isin=isin,
                yahoo_symbol=f"{symbol}.NS",
            )
        )

    return ParsedUniverseCSV(total=total, invalid=invalid, rows=rows)
