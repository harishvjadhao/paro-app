import { apiRequest } from './client'

export type Segment = 'Delivery' | 'Intraday'

export type ChargeBreakdown = {
  buy_val: number
  sell_val: number
  turnover: number
  brokerage: number
  stt: number
  txn: number
  sebi: number
  stamp: number
  gst: number
  dp: number
  total: number
  gross: number
  net: number
}

export type Trade = {
  id: number
  user_id: number
  symbol: string
  segment: Segment
  side: 'long' | 'short'
  qty: number
  entry_price: number
  entry_date: string
  exit_price: number | null
  exit_date: string | null
  tags: string[]
  notes: string
  created_at: string
  is_open: boolean
  charges: ChargeBreakdown
  last_close: number | null
  unrealized: number | null
}

export type JournalSummary = {
  trade_count: number
  open_count: number
  realized_net: number
  unrealized: number
  total_charges: number
  win_rate: number | null
}

export type TradeListResponse = {
  items: Trade[]
  summary: JournalSummary
}

export type TradeCreatePayload = {
  symbol: string
  segment: Segment
  qty: number
  entry_price: number
  entry_date: string
  exit_price?: number | null
  exit_date?: string | null
  tags?: string[]
  notes?: string
}

export type TradeUpdatePayload = {
  notes?: string
  tags?: string[]
  exit_price?: number | null
  exit_date?: string | null
  clear_exit?: boolean
  symbol?: string
  segment?: Segment
  qty?: number
  entry_price?: number
  entry_date?: string
}

export type EquityPoint = {
  date: string
  trade_id: number
  symbol: string
  net: number
  cumulative: number
}

export type JournalAnalytics = {
  closed_count: number
  avg_win: number | null
  avg_loss: number | null
  expectancy: number | null
  largest_win: number | null
  largest_loss: number | null
  equity_curve: EquityPoint[]
  by_segment: { segment: Segment; count: number; net: number; charges: number }[]
  by_symbol: { symbol: string; count: number; net: number }[]
}

export type PositionsResponse = {
  items: {
    id: number
    symbol: string
    segment: Segment
    qty: number
    entry_price: number
    entry_date: string
    tags: string[]
    notes: string
    last_close: number | null
    unrealized: number | null
  }[]
  total_unrealized: number
}

export type ImportResponse = {
  imported: number
  skipped: number
  items: Trade[]
}

function qs(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value)
  })
  const text = search.toString()
  return text ? `?${text}` : ''
}

export async function listTrades(params: {
  q?: string
  segment?: string
  tag?: string
  from?: string
  to?: string
} = {}): Promise<TradeListResponse> {
  return apiRequest<TradeListResponse>(`/journal/trades${qs(params)}`)
}

export async function createTrade(payload: TradeCreatePayload): Promise<Trade> {
  return apiRequest<Trade>('/journal/trades', { method: 'POST', body: JSON.stringify(payload) })
}

export async function updateTrade(id: number, payload: TradeUpdatePayload): Promise<Trade> {
  return apiRequest<Trade>(`/journal/trades/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export async function deleteTrade(id: number): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>(`/journal/trades/${id}`, { method: 'DELETE' })
}

export async function previewCharges(payload: {
  segment: Segment
  qty: number
  entry_price: number
  exit_price?: number | null
}): Promise<ChargeBreakdown> {
  return apiRequest<ChargeBreakdown>('/journal/charges/preview', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getJournalAnalytics(): Promise<JournalAnalytics> {
  return apiRequest<JournalAnalytics>('/journal/analytics')
}

export async function getJournalPositions(): Promise<PositionsResponse> {
  return apiRequest<PositionsResponse>('/journal/positions')
}

export async function exportJournalCsv(): Promise<string> {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'}/journal/export`)
  if (!response.ok) {
    throw new Error('Export failed')
  }
  return response.text()
}

export async function importJournalCsv(file: File): Promise<ImportResponse> {
  const form = new FormData()
  form.append('file', file)
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'}/journal/import`, {
    method: 'POST',
    body: form,
  })
  const payload = (await response.json()) as ImportResponse | { error?: { message?: string } }
  if (!response.ok) {
    throw new Error((payload as { error?: { message?: string } }).error?.message ?? 'Import failed')
  }
  return payload as ImportResponse
}
