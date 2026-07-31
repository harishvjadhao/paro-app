from datetime import date, timedelta

from app.services.candles import (
    Bar,
    aggregate_monthly,
    aggregate_weekly,
    bollinger_bands,
    ma44_series,
    population_stdev,
    wilder_rsi,
)
from app.services.indicators import above_ma, ma44, pct_vs_ma


def _daily(n: int = 60, start: date | None = None) -> list[Bar]:
    start = start or date(2024, 1, 2)
    bars: list[Bar] = []
    d = start
    price = 100.0
    while len(bars) < n:
        if d.weekday() < 5:
            o = price
            c = price + (len(bars) % 5 - 2) * 0.5
            bars.append(Bar(d, o, max(o, c) + 1, min(o, c) - 1, c, 1000 + len(bars)))
            price = c
        d += timedelta(days=1)
    return bars


def test_ma44_breadth():
    closes = [float(i) for i in range(1, 45)]
    m = ma44(closes)
    assert m == sum(closes) / 44
    assert above_ma(44.0, m)
    assert round(pct_vs_ma(m * 1.1, m), 6) == 10.0


def test_weekly_monthly_aggregation():
    daily = _daily(25, start=date(2024, 1, 1))
    weekly = aggregate_weekly(daily)
    assert weekly
    # first week open = first daily open; high/low envelope
    w0 = weekly[0]
    week0_days = [b for b in daily if b.date.isocalendar()[:2] == w0.date.isocalendar()[:2]]
    assert w0.open == week0_days[0].open
    assert w0.close == week0_days[-1].close
    assert w0.high == max(b.high for b in week0_days)
    assert w0.low == min(b.low for b in week0_days)
    assert w0.volume == sum(b.volume for b in week0_days)

    monthly = aggregate_monthly(daily)
    assert monthly
    m0_days = [b for b in daily if (b.date.year, b.date.month) == (monthly[0].date.year, monthly[0].date.month)]
    assert monthly[0].open == m0_days[0].open
    assert monthly[0].close == m0_days[-1].close


def test_bollinger_population_sigma():
    closes = [10.0, 12.0, 11.0, 15.0, 14.0] + [13.0] * 15  # 20 values
    mid, up, lo = bollinger_bands(closes, period=20, k=2)
    assert mid[-1] is not None
    sigma = population_stdev(closes)
    assert abs(up[-1] - (mid[-1] + 2 * sigma)) < 1e-9
    assert abs(lo[-1] - (mid[-1] - 2 * sigma)) < 1e-9
    assert mid[0] is None


def test_wilder_rsi_seed_and_bounds():
    # Strictly rising → RSI near 100
    closes = [float(i) for i in range(1, 40)]
    rsi = wilder_rsi(closes, period=14)
    assert rsi[14] is not None
    assert rsi[14] == 100.0
    assert all(v is None or 0 <= v <= 100 for v in rsi)

    # Flat after seed
    flat = [10.0] * 30
    rsi_flat = wilder_rsi(flat, period=14)
    # no gains/losses → avgLoss 0 → 100 by convention, or undefined; our impl → 100
    assert rsi_flat[14] == 100.0


def test_ma44_series_alignment():
    closes = [float(i) for i in range(1, 50)]
    series = ma44_series(closes)
    assert series[42] is None
    assert series[43] == sum(closes[0:44]) / 44
