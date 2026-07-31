import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../Icon";
import { fmtPct, fmtPrice } from "@/lib/format";
import { useWatchlistMutations } from "@/hooks/useWatchlist";
import { usePrefs } from "@/store/prefs";
import type { IndustryGroup, StockFilter, StockListItem } from "@/lib/types";

const FILTERS: Array<{ id: StockFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "ma", label: "44 MA" },
  { id: "fav", label: "Favorites" },
  { id: "watch", label: "Watchlist" },
];

type Props = {
  groups: IndustryGroup[] | undefined;
  isLoading: boolean;
  universeEmpty: boolean;
  search: string;
  onSearch: (q: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onOpenPalette: () => void;
  visibleSymbols: string[];
};

export function DiscoveryList({
  groups,
  isLoading,
  universeEmpty,
  search,
  onSearch,
  searchInputRef,
  onOpenPalette,
  visibleSymbols,
}: Props) {
  const filter = usePrefs((s) => s.filter);
  const setFilter = usePrefs((s) => s.setFilter);
  const dense = usePrefs((s) => s.dense);
  const toggleDense = usePrefs((s) => s.toggleDense);
  const collapsed = usePrefs((s) => s.collapsed);
  const toggleCollapsed = usePrefs((s) => s.toggleCollapsed);
  const setCollapsedAll = usePrefs((s) => s.setCollapsedAll);
  const selected = usePrefs((s) => s.selected);
  const setSelected = usePrefs((s) => s.setSelected);
  const { fav, watch, reorder } = useWatchlistMutations();
  const [searchFocus, setSearchFocus] = useState(false);
  const blurTimer = useRef<number | null>(null);

  const allCollapsed =
    !!groups?.length && groups.every((g) => collapsed[g.industry]);

  const favorites = useMemo(() => {
    const list: StockListItem[] = [];
    (groups || []).forEach((g) => {
      g.stocks.forEach((s) => {
        if (s.favorite) list.push(s);
      });
    });
    return list;
  }, [groups]);

  const showFavDropdown = searchFocus && !search.trim() && !universeEmpty;

  useEffect(() => {
    return () => {
      if (blurTimer.current) window.clearTimeout(blurTimer.current);
    };
  }, []);

  const moveInGroup = (
    industry: string,
    symbol: string,
    dir: -1 | 1,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    const grp = groups?.find((g) => g.industry === industry);
    if (!grp) return;
    const syms = grp.stocks.map((s) => s.symbol);
    const i = syms.indexOf(symbol);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= syms.length) return;
    const next = [...syms];
    [next[i], next[j]] = [next[j], next[i]];
    reorder.mutate({ industry, symbols: next });
  };

  return (
    <aside className="discovery">
      <div className="discovery-head">
        <div className="discovery-title-row">
          <div className="discovery-brand">
            <span className="discovery-name">PaRo</span>
            <span className="discovery-sub">Nifty 200 review</span>
          </div>
          <div className="discovery-actions">
            <button
              type="button"
              className="icon-chip"
              title="Command palette (⌘K)"
              onClick={onOpenPalette}
            >
              <Icon name="command" size={14} />
            </button>
            <button
              type="button"
              className={`icon-chip${dense ? " is-on" : ""}`}
              title="Toggle density"
              onClick={toggleDense}
            >
              <Icon name="rows-3" size={14} />
            </button>
            <button
              type="button"
              className="text-chip"
              onClick={() =>
                setCollapsedAll(
                  (groups || []).map((g) => g.industry),
                  !allCollapsed,
                )
              }
            >
              {allCollapsed ? "Expand all" : "Collapse all"}
            </button>
          </div>
        </div>

        <div className="search-wrap">
          <Icon name="search" size={15} className="search-ico" />
          <input
            ref={searchInputRef as React.RefObject<HTMLInputElement>}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            onFocus={() => {
              if (blurTimer.current) window.clearTimeout(blurTimer.current);
              setSearchFocus(true);
            }}
            onBlur={() => {
              blurTimer.current = window.setTimeout(
                () => setSearchFocus(false),
                150,
              );
            }}
            placeholder="Search symbol, company, or industry"
            className="search-input"
          />
          {showFavDropdown && (
            <div className="fav-dropdown">
              <div className="fav-dropdown-head">
                <Icon name="star" size={12} />
                Favorites
              </div>
              {favorites.length === 0 ? (
                <div className="fav-empty">
                  No favorites yet. Tap the star on a stock to add it here.
                </div>
              ) : (
                favorites.map((fv) => (
                  <button
                    key={fv.symbol}
                    type="button"
                    className="fav-row"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSelected(fv.symbol);
                    }}
                  >
                    <Icon name="star" size={13} />
                    <span className="fav-sym">{fv.symbol}</span>
                    <span className="fav-co">{fv.company}</span>
                    <span
                      className={
                        (fv.pct_vs_ma ?? 0) >= 0 ? "pos" : "neg"
                      }
                    >
                      {fmtPct(fv.pct_vs_ma)}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="filter-chips">
          {FILTERS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`chip${filter === c.id ? " is-on" : ""}`}
              onClick={() => setFilter(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="discovery-list">
        {universeEmpty && !isLoading && (
          <div className="empty-block">
            <div className="empty-ico">
              <Icon name="database" size={22} />
            </div>
            <div className="empty-title">No stock universe</div>
            <div className="empty-copy">
              Upload a Nifty 200 stock list in Admin to populate the workspace,
              sectors, and trends.
            </div>
          </div>
        )}

        {isLoading && (
          <div className="skel-list">
            <div className="skel skel-line w38" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skel-card">
                <div className="skel-card-body">
                  <div className="skel skel-line w55" />
                  <div className="skel skel-line w80" />
                </div>
                <div className="skel skel-pill" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && !universeEmpty && (groups?.length ?? 0) === 0 && (
          <div className="empty-block">
            <div className="empty-ico">
              <Icon name="search-x" size={22} />
            </div>
            <div className="empty-title">No matching stocks</div>
            <div className="empty-copy">
              No stocks in the active universe match &ldquo;{search}&rdquo; and
              the selected filters. Try clearing filters or search.
            </div>
          </div>
        )}

        {!isLoading &&
          !universeEmpty &&
          groups?.map((grp) => {
            const open = !collapsed[grp.industry];
            const above = grp.stocks.filter((s) => s.above).length;
            const total = grp.stocks.length;
            const pct = total ? Math.round((above / total) * 100) : 0;
            return (
              <div key={grp.industry} className="ind-group">
                <button
                  type="button"
                  className="ind-head"
                  onClick={() => toggleCollapsed(grp.industry)}
                >
                  <Icon
                    name={open ? "chevron-down" : "chevron-right"}
                    size={15}
                  />
                  <span className="ind-name">{grp.industry}</span>
                  <span className="ind-count">
                    {above}/{total} above
                  </span>
                  <span className={`ind-pct${pct >= 50 ? " is-good" : ""}`}>
                    {pct}% above
                  </span>
                </button>
                {open &&
                  grp.stocks.map((s) => {
                    const active = s.symbol === selected;
                    return (
                      <div
                        key={s.symbol}
                        className={`stock-row${dense ? " is-dense" : ""}${active ? " is-active" : ""}`}
                        onClick={() => setSelected(s.symbol)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") setSelected(s.symbol);
                        }}
                        data-sym={s.symbol}
                      >
                        <div className="stock-main">
                          <div className="stock-left">
                            <div className="stock-sym-row">
                              <span className="stock-sym">{s.symbol}</span>
                              <span
                                className={`ma-badge${s.above ? " above" : " below"}`}
                              >
                                {s.above ? "Above 44 MA" : "Below 44 MA"}
                              </span>
                            </div>
                            <div className="stock-co">
                              {s.company}
                              {s.as_of ? ` · ${s.as_of.slice(0, 10)}` : ""}
                            </div>
                          </div>
                          <div className="stock-right">
                            <div
                              className={
                                (s.pct_vs_ma ?? 0) >= 0 ? "pos" : "neg"
                              }
                            >
                              {fmtPct(s.pct_vs_ma)}
                            </div>
                            <div className="stock-ma">
                              MA44 {fmtPrice(s.ma44, 1)}
                            </div>
                          </div>
                        </div>
                        {!dense && (
                          <div className="stock-tools">
                            <button
                              type="button"
                              title="Favorite"
                              className={`tool-btn${s.favorite ? " is-fav" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                fav.mutate(s.symbol);
                              }}
                            >
                              <Icon name="star" size={14} />
                            </button>
                            <button
                              type="button"
                              title="Watchlist"
                              className={`tool-btn${s.watchlist ? " is-watch" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                watch.mutate(s.symbol);
                              }}
                            >
                              <Icon name="bookmark" size={14} />
                            </button>
                            <button
                              type="button"
                              title="Open external chart"
                              className="tool-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(
                                  `https://finance.yahoo.com/quote/${encodeURIComponent(s.yahoo_symbol)}`,
                                  "_blank",
                                  "noopener,noreferrer",
                                );
                              }}
                            >
                              <Icon name="external-link" size={14} />
                            </button>
                            <div className="flex-1" />
                            <button
                              type="button"
                              title="Move up in group"
                              className="tool-btn"
                              onClick={(e) =>
                                moveInGroup(grp.industry, s.symbol, -1, e)
                              }
                            >
                              <Icon name="chevron-up" size={15} />
                            </button>
                            <button
                              type="button"
                              title="Move down in group"
                              className="tool-btn"
                              onClick={(e) =>
                                moveInGroup(grp.industry, s.symbol, 1, e)
                              }
                            >
                              <Icon name="chevron-down" size={15} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            );
          })}
      </div>
      <span className="sr-only">{visibleSymbols.join(",")}</span>
    </aside>
  );
}
