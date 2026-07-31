import { apiDelete, apiGet, apiPatch, apiPost } from "./api";
import type {
  CandlesResponse,
  Comment,
  IndustryGroup,
  StockDetail,
  StockFilter,
  Timeframe,
  UniverseStock,
  WatchToggle,
} from "./types";

export function fetchStocks(filter: StockFilter, q = "") {
  const params = new URLSearchParams({ filter });
  if (q.trim()) params.set("q", q.trim());
  return apiGet<IndustryGroup[]>(`/stocks?${params}`);
}

export function fetchStock(symbol: string) {
  return apiGet<StockDetail>(`/stocks/${encodeURIComponent(symbol)}`);
}

export function fetchCandles(
  symbol: string,
  timeframe: Timeframe,
  opts?: { bars?: number; bollinger?: boolean; rsi?: boolean },
) {
  const indicators = ["ma44"];
  if (opts?.bollinger) indicators.push("bb");
  if (opts?.rsi) indicators.push("rsi");
  const params = new URLSearchParams({
    timeframe,
    bars: String(opts?.bars ?? 44),
    indicators: indicators.join(","),
  });
  return apiGet<CandlesResponse>(
    `/stocks/${encodeURIComponent(symbol)}/candles?${params}`,
  );
}

export function fetchComments(symbol: string) {
  return apiGet<Comment[]>(`/stocks/${encodeURIComponent(symbol)}/comments`);
}

export function createComment(symbol: string, body: string) {
  return apiPost<Comment>(`/stocks/${encodeURIComponent(symbol)}/comments`, {
    body,
  });
}

export function updateComment(symbol: string, id: number, body: string) {
  return apiPatch<Comment>(
    `/stocks/${encodeURIComponent(symbol)}/comments/${id}`,
    { body },
  );
}

export function deleteComment(symbol: string, id: number) {
  return apiDelete(`/stocks/${encodeURIComponent(symbol)}/comments/${id}`);
}

export function toggleFavorite(symbol: string) {
  return apiPost<WatchToggle>(
    `/watchlist/${encodeURIComponent(symbol)}/favorite`,
  );
}

export function toggleWatch(symbol: string) {
  return apiPost<WatchToggle>(`/watchlist/${encodeURIComponent(symbol)}/watch`);
}

export function reorderWatchlist(industry: string, symbols: string[]) {
  return apiPost<{ ok: boolean }>("/watchlist/reorder", { industry, symbols });
}

export function fetchUniverse() {
  return apiGet<UniverseStock[]>("/universe");
}
