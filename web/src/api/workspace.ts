import { apiRequest } from './client'

export type StockListItem = {
  symbol: string
  company: string
  industry: string
  series: string
  isin: string
  yahoo_symbol: string
  close: number
  ma44: number | null
  pct_vs_ma44: number
  above_ma44: boolean
  is_favorite: boolean
  is_watchlist: boolean
  last_sync: string
}

export type StockComment = {
  id: number
  symbol: string
  body: string
  created_at: string
  updated_at: string
}

export type StockDetail = {
  symbol: string
  company: string
  industry: string
  series: string
  isin: string
  yahoo_symbol: string
  close: number
  ma44: number | null
  pct_vs_ma44: number
  above_ma44: boolean
  is_favorite: boolean
  is_watchlist: boolean
  last_sync: string
  comments: StockComment[]
}

export type CandleItem = {
  date: string
  o: number
  h: number
  l: number
  c: number
  v: number
  ma44: number | null
  bb_upper: number | null
  bb_mid: number | null
  bb_lower: number | null
  rsi14: number | null
}

export type ChartMarker = {
  date: string
  kind: 'comment' | 'highlight' | 'entry' | 'exit'
  id?: number | null
  label?: string | null
  color?: string | null
}

export type PriceLevel = {
  price: number
  color: string
  label?: string
}

export type CandleResponse = {
  symbol: string
  timeframe: 'D' | 'W' | 'M'
  bars: CandleItem[]
  markers: ChartMarker[]
}

export type ReorderResponse = {
  updated: number
}

export async function getStocks(filter: 'all' | 'ma' | 'fav' | 'watch', q: string): Promise<StockListItem[]> {
  const params = new URLSearchParams({ filter, q })
  return apiRequest<StockListItem[]>(`/stocks?${params.toString()}`)
}

export async function getStockDetail(symbol: string): Promise<StockDetail> {
  return apiRequest<StockDetail>(`/stocks/${symbol}`)
}

export async function getStockCandles(
  symbol: string,
  timeframe: 'D' | 'W' | 'M',
  indicators: string,
  bars = 44,
): Promise<CandleResponse> {
  const params = new URLSearchParams({ timeframe, bars: String(bars), indicators })
  return apiRequest<CandleResponse>(`/stocks/${symbol}/candles?${params.toString()}`)
}

export async function toggleFavorite(symbol: string): Promise<{ symbol: string; is_favorite: boolean; is_watchlist: boolean }> {
  return apiRequest(`/stocks/${symbol}/favorite`, { method: 'POST' })
}

export async function toggleWatch(symbol: string): Promise<{ symbol: string; is_favorite: boolean; is_watchlist: boolean }> {
  return apiRequest(`/stocks/${symbol}/watch`, { method: 'POST' })
}

export async function syncOne(symbol: string): Promise<void> {
  await apiRequest(`/admin/sync/${symbol}`, { method: 'POST' })
}

export async function addComment(symbol: string, body: string): Promise<StockComment> {
  return apiRequest<StockComment>(`/stocks/${symbol}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  })
}

export async function updateComment(symbol: string, commentId: number, body: string): Promise<StockComment> {
  return apiRequest<StockComment>(`/stocks/${symbol}/comments/${commentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ body }),
  })
}

export async function deleteComment(symbol: string, commentId: number): Promise<void> {
  await apiRequest(`/stocks/${symbol}/comments/${commentId}`, { method: 'DELETE' })
}

export async function reorderStocks(industry: string, symbols: string[]): Promise<ReorderResponse> {
  return apiRequest<ReorderResponse>('/stocks/order', {
    method: 'PATCH',
    body: JSON.stringify({ industry, symbols }),
  })
}
