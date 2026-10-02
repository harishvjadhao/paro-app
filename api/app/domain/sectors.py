from __future__ import annotations

from statistics import fmean


def breadth_pct(above_flags: list[bool]) -> float:
    if not above_flags:
        return 0.0
    return (sum(1 for flag in above_flags if flag) / len(above_flags)) * 100.0


def weekly_breadth_series(
    daily_above_matrix: list[list[bool]],
    *,
    week_days: int = 5,
    weeks: int = 8,
) -> list[dict[str, float]]:
    """Average daily breadth across each of the last `weeks` windows.

    `daily_above_matrix` is one row per stock, each a chronologically ordered
    list of same-length daily above-44MA flags.
    """
    if week_days <= 0 or weeks <= 0:
        raise ValueError("week_days and weeks must be > 0")
    if not daily_above_matrix:
        return [{"pct": 0.0, "avg_above": 0.0} for _ in range(weeks)]

    length = min(len(row) for row in daily_above_matrix)
    if length == 0:
        return [{"pct": 0.0, "avg_above": 0.0} for _ in range(weeks)]

    needed = week_days * weeks
    start = max(0, length - needed)
    cells: list[dict[str, float]] = []
    for week_index in range(weeks):
        week_start = start + week_index * week_days
        week_end = min(length, week_start + week_days)
        if week_start >= length:
            cells.append({"pct": 0.0, "avg_above": 0.0})
            continue

        day_count = week_end - week_start
        above_sum = 0
        observations = 0
        for row in daily_above_matrix:
            for day in range(week_start, week_end):
                observations += 1
                if row[day]:
                    above_sum += 1
        pct = (above_sum / observations) * 100.0 if observations else 0.0
        avg_above = above_sum / day_count if day_count else 0.0
        cells.append({"pct": round(pct, 2), "avg_above": round(avg_above, 2)})
    return cells


def rotation_coordinates(weekly_pcts: list[float]) -> tuple[float, float]:
    """x = 8-week avg breadth; y = latest week − average of prior 4 weeks."""
    if not weekly_pcts:
        return 0.0, 0.0
    x = fmean(weekly_pcts)
    latest = weekly_pcts[-1]
    prior = weekly_pcts[-5:-1] if len(weekly_pcts) >= 5 else weekly_pcts[:-1]
    prior_avg = fmean(prior) if prior else latest
    y = latest - prior_avg
    return round(x, 2), round(y, 2)


def week_window(length: int, week_index: int, *, week_days: int = 5, weeks: int = 8) -> tuple[int, int]:
    """Return [start, end) day indices for a week column in the trailing window."""
    if week_index < 0 or week_index >= weeks:
        raise ValueError("week_index out of range")
    needed = week_days * weeks
    start = max(0, length - needed)
    week_start = start + week_index * week_days
    week_end = min(length, week_start + week_days)
    return week_start, week_end


def stock_week_above_share(flags: list[bool], week_index: int, *, week_days: int = 5, weeks: int = 8) -> float:
    if not flags:
        return 0.0
    week_start, week_end = week_window(len(flags), week_index, week_days=week_days, weeks=weeks)
    if week_start >= week_end:
        return 0.0
    slice_flags = flags[week_start:week_end]
    return sum(1 for flag in slice_flags if flag) / len(slice_flags)
