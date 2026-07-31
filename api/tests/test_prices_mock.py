from datetime import date, timedelta

from app.providers.prices.mock import MockPriceProvider
from app.services.indicators import above_ma, ma44, pct_vs_ma
from app.services.sync import FULL_YEARS


def test_mock_provider_weekday_bars():
    p = MockPriceProvider()
    start = date(2024, 1, 1)
    end = date(2024, 1, 31)
    bars = p.fetch_daily("RELIANCE.NS", start, end)
    assert bars
    assert all(b.date.weekday() < 5 for b in bars)
    assert all(b.high >= b.low for b in bars)


def test_mock_forced_failure():
    p = MockPriceProvider()
    try:
        p.fetch_daily("FAIL.NS", date.today() - timedelta(days=5), date.today())
        assert False, "expected failure"
    except RuntimeError as e:
        assert "forced failure" in str(e)


def test_ma44_and_breadth():
    closes = [float(i) for i in range(1, 45)]
    m = ma44(closes)
    assert m == sum(closes) / 44
    assert above_ma(closes[-1], m)
    assert pct_vs_ma(m, m) == 0.0
    assert ma44(closes[:10]) is None


def test_full_window_years_constant():
    assert FULL_YEARS == 4
