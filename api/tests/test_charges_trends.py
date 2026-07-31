from app.services.charges import DELIVERY_DP, zerodha_charges
from app.services.sectors import avg_weekly_breadth, rotation_xy


def test_delivery_includes_dp():
    ch = zerodha_charges(segment="Delivery", qty=10, buy=100.0, sell=110.0)
    assert ch.dp == DELIVERY_DP
    assert ch.brokerage == 0
    assert ch.total > DELIVERY_DP
    assert abs(ch.gross - 100.0) < 1e-9
    assert abs(ch.net - (ch.gross - ch.total)) < 1e-9


def test_intraday_no_dp_and_brokerage_cap():
    ch = zerodha_charges(segment="Intraday", qty=1000, buy=500.0, sell=501.0)
    assert ch.dp == 0
    # large notional → brokerage capped at 20+20
    assert ch.brokerage == 40.0


def test_open_trade_unrealized():
    ch = zerodha_charges(segment="Delivery", qty=5, buy=100.0, sell=None, last_close=120.0)
    assert ch.total == 0
    assert ch.unrealized == 100.0


def test_weekly_breadth_avg():
    assert avg_weekly_breadth([50, 60, 70]) == 60.0
    assert avg_weekly_breadth([]) == 0.0


def test_rotation_xy():
    weeks = [40, 42, 44, 46, 50, 60]  # latest 60, prior4 mean of 42,44,46,50 = 45.5
    x, y = rotation_xy(weeks)
    assert abs(x - sum(weeks) / len(weeks)) < 1e-9
    assert abs(y - (60 - 45.5)) < 1e-9
