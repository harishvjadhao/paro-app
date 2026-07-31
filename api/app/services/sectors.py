"""Sector breadth, weekly trends, rotation (pure + DB-backed)."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from statistics import mean

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import PriceBar, StockUniverse
from app.services.indicators import above_ma, ma44, pct_vs_ma


def _closes_through(db: Session, symbol: str, as_of: date, need: int = 44) -> list[float]:
    rows = db.execute(
        select(PriceBar.close)
        .where(PriceBar.symbol == symbol, PriceBar.date <= as_of)
        .order_by(PriceBar.date.desc())
        .limit(need)
    ).all()
    return [float(c) for (c,) in reversed(rows)]


def breadth_for_sector(db: Session, industry: str, as_of: date | None = None) -> dict:
    as_of = as_of or date.today()
    stocks = list(
        db.scalars(
            select(StockUniverse).where(
                StockUniverse.active.is_(True), StockUniverse.industry == industry
            )
        ).all()
    )
    constituents = []
    above_n = 0
    for s in stocks:
        closes = _closes_through(db, s.symbol, as_of)
        if len(closes) < 44:
            continue
        m = ma44(closes)
        close = closes[-1]
        if m is None:
            continue
        ab = above_ma(close, m)
        if ab:
            above_n += 1
        constituents.append(
            {
                "symbol": s.symbol,
                "company": s.company,
                "close": close,
                "ma44": m,
                "above": ab,
                "pct_vs_ma": pct_vs_ma(close, m),
            }
        )
    total = len(constituents)
    breadth = (above_n / total * 100.0) if total else 0.0
    leaders = sorted(constituents, key=lambda x: x["pct_vs_ma"], reverse=True)[:5]
    return {
        "industry": industry,
        "as_of": as_of.isoformat(),
        "breadth": breadth,
        "above": above_n,
        "total": total,
        "constituents": constituents,
        "leaders": leaders,
    }


def list_sectors(db: Session) -> list[dict]:
    industries = list(
        db.scalars(
            select(StockUniverse.industry)
            .where(StockUniverse.active.is_(True))
            .distinct()
            .order_by(StockUniverse.industry)
        ).all()
    )
    return [breadth_for_sector(db, ind) for ind in industries]


def _trading_days(db: Session, end: date, n: int) -> list[date]:
    rows = db.execute(
        select(PriceBar.date).where(PriceBar.date <= end).distinct().order_by(PriceBar.date.desc()).limit(n * 3)
    ).all()
    days = [r[0] for r in rows]
    days = sorted(set(days))
    return days[-n:] if len(days) >= n else days


def weekly_breadth_matrix(db: Session, weeks: int = 8) -> dict:
    """Per sector, last `weeks` ISO weeks: avg daily breadth across trading days in week."""
    end = date.today()
    # gather ~ weeks*5 trading days + buffer
    days = _trading_days(db, end, weeks * 7 + 10)
    if not days:
        return {"weeks": [], "sectors": []}

    # group days into ISO weeks (most recent `weeks`)
    by_week: dict[tuple[int, int], list[date]] = defaultdict(list)
    for d in days:
        by_week[(d.isocalendar().year, d.isocalendar().week)].append(d)
    week_keys = sorted(by_week.keys())[-weeks:]
    week_labels = [f"{y}-W{w:02d}" for y, w in week_keys]

    industries = list(
        db.scalars(
            select(StockUniverse.industry)
            .where(StockUniverse.active.is_(True))
            .distinct()
            .order_by(StockUniverse.industry)
        ).all()
    )

    sectors_out = []
    for industry in industries:
        stocks = list(
            db.scalars(
                select(StockUniverse).where(
                    StockUniverse.active.is_(True), StockUniverse.industry == industry
                )
            ).all()
        )
        cells = []
        for y, w in week_keys:
            day_breadths = []
            day_above_counts = []
            for d in by_week[(y, w)]:
                above_n = 0
                total = 0
                for s in stocks:
                    closes = _closes_through(db, s.symbol, d)
                    if len(closes) < 44:
                        continue
                    m = ma44(closes)
                    if m is None:
                        continue
                    total += 1
                    if above_ma(closes[-1], m):
                        above_n += 1
                if total:
                    day_breadths.append(above_n / total * 100.0)
                    day_above_counts.append(above_n)
            if day_breadths:
                cells.append(
                    {
                        "week": f"{y}-W{w:02d}",
                        "pct": round(mean(day_breadths), 1),
                        "avg_above": round(mean(day_above_counts), 1),
                        "total": len(stocks),
                    }
                )
            else:
                cells.append({"week": f"{y}-W{w:02d}", "pct": 0.0, "avg_above": 0.0, "total": len(stocks)})
        avg8 = mean([c["pct"] for c in cells]) if cells else 0.0
        sectors_out.append({"name": industry, "cells": cells, "avg8": round(avg8, 1)})

    sectors_out.sort(key=lambda s: s["avg8"], reverse=True)
    return {"weeks": week_labels, "sectors": sectors_out}


def weekly_drill(db: Session, sector: str, week_index: int) -> dict:
    matrix = weekly_breadth_matrix(db)
    if week_index < 0 or week_index >= len(matrix["weeks"]):
        raise ValueError("weekIndex out of range")
    week_label = matrix["weeks"][week_index]
    # find mid trading day of that week for snapshot
    y, w = int(week_label.split("-W")[0]), int(week_label.split("-W")[1])
    # approximate as_of = Thursday of that ISO week
    as_of = date.fromisocalendar(y, w, 4)
    data = breadth_for_sector(db, sector, as_of=as_of)
    data["week"] = week_label
    data["weekIndex"] = week_index
    return data


def rotation_points(db: Session) -> list[dict]:
    matrix = weekly_breadth_matrix(db)
    points = []
    for s in matrix["sectors"]:
        cells = s["cells"]
        if len(cells) < 5:
            continue
        x = mean([c["pct"] for c in cells])  # 8-week avg breadth
        latest = cells[-1]["pct"]
        prior4 = mean([c["pct"] for c in cells[-5:-1]])
        y = latest - prior4
        points.append({"sector": s["name"], "x": round(x, 2), "y": round(y, 2), "breadth": cells[-1]["pct"]})
    return points


# --- Pure helpers for unit tests (no DB) ---


def avg_weekly_breadth(daily_pcts: list[float]) -> float:
    return mean(daily_pcts) if daily_pcts else 0.0


def rotation_xy(week_pcts: list[float]) -> tuple[float, float]:
    """week_pcts oldest→newest, length >= 5."""
    x = mean(week_pcts)
    y = week_pcts[-1] - mean(week_pcts[-5:-1])
    return x, y
