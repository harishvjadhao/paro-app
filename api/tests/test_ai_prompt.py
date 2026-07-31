from app.api.ai import build_grounded_prompt


def test_grounded_prompt_includes_breadth():
    data = {
        "industry": "Financial Services",
        "above": 2,
        "total": 4,
        "breadth": 50.0,
        "constituents": [
            {"symbol": "HDFCBANK", "pct_vs_ma": 1.2, "above": True},
            {"symbol": "SBIN", "pct_vs_ma": -2.0, "above": False},
        ],
    }
    msgs = build_grounded_prompt(data, "Who leads?")
    assert msgs[0]["role"] == "system"
    assert "Financial Services" in msgs[1]["content"]
    assert "HDFCBANK" in msgs[1]["content"]
    assert "Who leads?" in msgs[1]["content"]
