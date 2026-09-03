import { apiRequest } from './client'

export type ChartHighlight = {
  id: number
  label: string
  color: string
  symbol: string | null
  date_from: string
  date_to: string
  reused_color: boolean
}

export type HighlightCreatePayload = {
  label: string
  date_from: string
  date_to?: string | null
  symbol?: string | null
  color?: string | null
}

export type HighlightUpdatePayload = {
  label?: string
  date_from?: string
  date_to?: string | null
  symbol?: string | null
  color?: string | null
  clear_symbol?: boolean
}

export async function listHighlights(): Promise<ChartHighlight[]> {
  return apiRequest<ChartHighlight[]>('/highlights')
}

export async function createHighlight(payload: HighlightCreatePayload): Promise<ChartHighlight> {
  return apiRequest<ChartHighlight>('/highlights', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateHighlight(id: number, payload: HighlightUpdatePayload): Promise<ChartHighlight> {
  return apiRequest<ChartHighlight>(`/highlights/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteHighlight(id: number): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>(`/highlights/${id}`, { method: 'DELETE' })
}
