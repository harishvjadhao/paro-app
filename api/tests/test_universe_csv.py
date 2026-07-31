from app.services.universe_csv import parse_universe_csv


SAMPLE = """Company Name,Industry,Symbol,Series,ISIN Code
Alpha Ltd,Financial Services,ALPHA,EQ,INE000A01001
Beta Ltd,Capital Goods,BETA,EQ,INE000B01002
Alpha Dup,Financial Services,ALPHA,EQ,INE000A01001
,Capital Goods,BAD,,
Gamma & Co,Automobile,M&M,EQ,INE000C01003
"""


def test_parse_counts_and_yahoo():
    r = parse_universe_csv(SAMPLE)
    assert r.total == 5
    assert r.duplicates == 1
    assert r.invalid == 1
    symbols = {row.symbol for row in r.rows}
    assert symbols == {"ALPHA", "BETA", "M&M"}
    mm = next(row for row in r.rows if row.symbol == "M&M")
    assert mm.yahoo_symbol == "M&M.NS"


def test_missing_headers():
    r = parse_universe_csv("a,b\n1,2\n")
    assert r.invalid >= 1
    assert any("missing headers" in m for m in r.invalid_messages)


def test_seed_file_shape():
    from pathlib import Path

    # api/tests -> api -> paro-app
    path = (
        Path(__file__).resolve().parents[2]
        / "Nifty Shares Viewer Wireframe"
        / "uploads"
        / "ind_nifty200list.csv"
    )
    assert path.exists(), path
    r = parse_universe_csv(path.read_bytes())
    assert r.total >= 190
    assert r.invalid == 0
    assert all(row.yahoo_symbol.endswith(".NS") for row in r.rows)
