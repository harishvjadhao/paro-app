from app.domain.indicators import aggregate, above_ma, bollinger, pct_vs_ma, rsi_wilder, sma


def test_sma_and_above_ma_and_pct() -> None:
    closes = [10.0, 11.0, 12.0, 13.0, 14.0]
    ma = sma(closes, 3)
    assert ma == [None, None, 11.0, 12.0, 13.0]
    assert above_ma(14.0, ma[-1]) is True
    assert round(pct_vs_ma(14.0, ma[-1]), 2) == 7.69


def test_weekly_and_monthly_aggregate() -> None:
    rows = [
        {"date": "2026-08-03", "o": 100.0, "h": 102.0, "l": 99.0, "c": 101.0, "v": 10.0},
        {"date": "2026-08-04", "o": 101.0, "h": 104.0, "l": 100.0, "c": 103.0, "v": 11.0},
        {"date": "2026-08-08", "o": 103.0, "h": 105.0, "l": 102.0, "c": 104.0, "v": 9.0},
        {"date": "2026-09-01", "o": 104.0, "h": 106.0, "l": 103.0, "c": 105.0, "v": 12.0},
    ]

    weekly = aggregate(rows, "W")
    assert len(weekly) == 2
    assert weekly[0]["o"] == 100.0
    assert weekly[0]["c"] == 104.0
    assert weekly[0]["h"] == 105.0
    assert weekly[0]["l"] == 99.0
    assert weekly[0]["v"] == 30.0

    monthly = aggregate(rows, "M")
    assert len(monthly) == 2
    assert monthly[0]["o"] == 100.0
    assert monthly[0]["c"] == 104.0


def test_bollinger_and_rsi() -> None:
    closes = [float(100 + idx) for idx in range(30)]

    bb = bollinger(closes, 20, 2.0)
    assert bb[18] == (None, None, None)
    upper, mid, lower = bb[19]
    assert upper is not None and mid is not None and lower is not None
    assert upper > mid > lower

    rsi = rsi_wilder(closes, 14)
    assert rsi[13] is None
    assert rsi[14] is not None
    assert 99.0 <= float(rsi[14]) <= 100.0
