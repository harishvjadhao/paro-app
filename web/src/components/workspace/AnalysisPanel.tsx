import { Icon } from "../Icon";
import { fmtPct, fmtPrice } from "@/lib/format";
import { useCandles, useStockDetail } from "@/hooks/useCandles";
import { useWatchlistMutations } from "@/hooks/useWatchlist";
import { usePrefs } from "@/store/prefs";
import { CommentsPanel } from "./CommentsPanel";
import { PriceTimeline } from "./PriceTimeline";
import type { StockListItem } from "@/lib/types";

type Props = {
  universeEmpty: boolean;
  listItem: StockListItem | null;
};

export function AnalysisPanel({ universeEmpty, listItem }: Props) {
  const selected = usePrefs((s) => s.selected);
  const setSelected = usePrefs((s) => s.setSelected);
  const timeframe = usePrefs((s) => s.timeframe);
  const bollinger = usePrefs((s) => s.bollinger);
  const rsi = usePrefs((s) => s.rsi);
  const detail = useStockDetail(selected);
  const candles = useCandles(selected, timeframe, bollinger, rsi);
  const { fav, watch } = useWatchlistMutations();

  if (universeEmpty) {
    return (
      <div className="panel">
        <div className="panel-empty">
          <div className="empty-ico accent">
            <Icon name="database" size={28} />
          </div>
          <div className="empty-title lg">No active universe</div>
          <div className="empty-copy">
            Only stocks from an uploaded list can be analysed or synced. Import
            a Nifty 200 CSV from Admin to get started.
          </div>
        </div>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="panel">
        <div className="panel-empty">
          <div className="empty-ico accent">
            <Icon name="candlestick-chart" size={28} />
          </div>
          <div className="empty-title lg">No stock selected</div>
          <div className="empty-copy">
            Choose a stock from the discovery list to see its signal, 44-candle
            price timeline, metrics, and comments. Adding comments is disabled
            until a stock is selected.
          </div>
        </div>
      </div>
    );
  }

  if (detail.isLoading) {
    return (
      <div className="panel">
        <div className="card skel-detail-head">
          <div className="skel-card-body">
            <div className="skel skel-line w26" />
            <div className="skel skel-line w52 tall" />
            <div className="skel skel-line w38" />
          </div>
          <div className="skel skel-signal" />
        </div>
        <div className="card">
          <div className="skel skel-line w180" />
          <div className="skel skel-line full" style={{ height: 44, marginTop: 14 }} />
          <div className="skel" style={{ height: 300, marginTop: 14, borderRadius: 10 }} />
        </div>
        <div className="metric-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skel" style={{ height: 82, borderRadius: 16 }} />
          ))}
        </div>
      </div>
    );
  }

  const s = detail.data;
  if (!s) {
    return (
      <div className="panel">
        <div className="panel-empty">
          <div className="empty-title lg">Stock not found</div>
          <div className="empty-copy">
            The selected symbol could not be loaded from the API.
          </div>
        </div>
      </div>
    );
  }

  const above = s.above;
  const pct = s.pct_vs_ma;
  const isFav = listItem?.favorite ?? false;
  const isWatch = listItem?.watchlist ?? false;

  return (
    <div className="panel">
      <section className="card stock-header">
        <div className="stock-header-main">
          <div className="card-kicker">Selected stock</div>
          <div className="stock-header-name">{s.company}</div>
          <div className="stock-header-meta">
            {s.symbol} · {s.industry}
          </div>
        </div>
        <div className={`signal-card${above ? " above" : " below"}`}>
          <div className="card-kicker">Signal</div>
          <div className="signal-label">
            <Icon name={above ? "trending-up" : "trending-down"} size={17} />
            {above ? "Above 44 MA" : "Below 44 MA"}
          </div>
        </div>
        <button
          type="button"
          className="clear-btn"
          title="Clear selection"
          onClick={() => setSelected(null)}
        >
          <Icon name="x" size={18} />
        </button>
      </section>

      <PriceTimeline data={candles.data} isLoading={candles.isLoading} />

      <div className="metric-grid">
        <div className="card metric">
          <div className="card-kicker">Close Price</div>
          <div className="metric-val">{fmtPrice(s.close)}</div>
        </div>
        <div className="card metric">
          <div className="card-kicker">44 Day MA</div>
          <div className="metric-val honey">{fmtPrice(s.ma44)}</div>
        </div>
        <div className="card metric">
          <div className="card-kicker">% Above MA</div>
          <div className={`metric-val${(pct ?? 0) >= 0 ? " pos" : " neg"}`}>
            {fmtPct(pct)}
          </div>
        </div>
      </div>

      <div className="meta-grid">
        <div className="card">
          <div className="card-kicker mb">Identifiers</div>
          <div className="kv">
            <span>Yahoo</span>
            <strong>{s.yahoo_symbol}</strong>
          </div>
          <div className="kv">
            <span>Series</span>
            <strong>{s.series}</strong>
          </div>
          <div className="kv">
            <span>ISIN</span>
            <strong>{s.isin}</strong>
          </div>
        </div>
        <div className="card">
          <div className="card-kicker mb">Data Freshness</div>
          <div className="kv">
            <span>Updated</span>
            <strong>{s.as_of ? s.as_of.slice(0, 10) : "—"}</strong>
          </div>
          <div className="kv">
            <span>Favorite</span>
            <button
              type="button"
              className={`linkish${isFav ? " honey" : ""}`}
              onClick={() => fav.mutate(s.symbol)}
            >
              {isFav ? "Yes" : "No"}
            </button>
          </div>
          <div className="kv">
            <span>Watchlist</span>
            <button
              type="button"
              className={`linkish${isWatch ? " accent" : ""}`}
              onClick={() => watch.mutate(s.symbol)}
            >
              {isWatch ? "Yes" : "No"}
            </button>
          </div>
        </div>
      </div>

      <CommentsPanel symbol={s.symbol} />
    </div>
  );
}
