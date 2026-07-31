import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DiscoveryList } from "@/components/workspace/DiscoveryList";
import { AnalysisPanel } from "@/components/workspace/AnalysisPanel";
import { useGlobalKeys } from "@/hooks/useGlobalKeys";
import { useStocks } from "@/hooks/useStocks";
import { useUniverse } from "@/hooks/useWatchlist";
import { usePrefs } from "@/store/prefs";
import type { StockFilter, StockListItem } from "@/lib/types";

function isFilter(v: string | null): v is StockFilter {
  return v === "all" || v === "ma" || v === "fav" || v === "watch";
}

type Props = {
  onOpenPalette: () => void;
};

export function WorkspacePage({ onOpenPalette }: Props) {
  const [params, setParams] = useSearchParams();
  const filter = usePrefs((s) => s.filter);
  const setFilter = usePrefs((s) => s.setFilter);
  const selected = usePrefs((s) => s.selected);
  const setSelected = usePrefs((s) => s.setSelected);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const urlFilter = params.get("filter");
    if (isFilter(urlFilter) && urlFilter !== filter) {
      setFilter(urlFilter);
    }
  }, [params, filter, setFilter]);

  useEffect(() => {
    if (params.get("filter") !== filter) {
      setParams({ filter }, { replace: true });
    }
  }, [filter, params, setParams]);

  const stocks = useStocks(filter, search);
  const universe = useUniverse();
  const universeEmpty =
    universe.isSuccess && (universe.data?.length ?? 0) === 0;

  const visibleSymbols = useMemo(() => {
    const syms: string[] = [];
    (stocks.data || []).forEach((g) =>
      g.stocks.forEach((s) => syms.push(s.symbol)),
    );
    return syms;
  }, [stocks.data]);

  const listItem: StockListItem | null = useMemo(() => {
    if (!selected) return null;
    for (const g of stocks.data || []) {
      const hit = g.stocks.find((s) => s.symbol === selected);
      if (hit) return hit;
    }
    return null;
  }, [selected, stocks.data]);

  const moveSelection = (dir: 1 | -1) => {
    if (!visibleSymbols.length) return;
    const cur = visibleSymbols.indexOf(selected || "");
    let next = cur + dir;
    if (cur < 0) next = 0;
    next = Math.max(0, Math.min(visibleSymbols.length - 1, next));
    setSelected(visibleSymbols[next]);
  };

  useGlobalKeys({
    onSlash: () => searchRef.current?.focus(),
    onArrowDown: () => moveSelection(1),
    onArrowUp: () => moveSelection(-1),
  });

  return (
    <div className="workspace">
      <DiscoveryList
        groups={stocks.data}
        isLoading={stocks.isLoading || universe.isLoading}
        universeEmpty={universeEmpty}
        search={search}
        onSearch={setSearch}
        searchInputRef={searchRef}
        onOpenPalette={onOpenPalette}
        visibleSymbols={visibleSymbols}
      />
      <AnalysisPanel universeEmpty={universeEmpty} listItem={listItem} />
    </div>
  );
}
