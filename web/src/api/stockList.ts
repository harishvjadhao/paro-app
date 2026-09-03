import { apiRequest } from './client'

export type ScreenLabel = 'Strong buy' | 'Buy' | 'Watch' | 'Avoid' | 'On hold'
export type ColumnType = 'text' | 'number' | 'choice' | 'date' | 'boolean' | 'signal20'

export type MaState = {
  above: boolean
  overridden: boolean
  ma20: number | null
  close: number | null
}

export type StockListRow = {
  symbol: string
  company: string
  industry: string
  subcategory: string
  notes: string
  screen: ScreenLabel
  screen_auto: ScreenLabel
  screen_overridden: boolean
  ma_d: MaState
  ma_w: MaState
  ma_m: MaState
  ma_m_label: string
  custom: Record<string, string | number | boolean | null>
}

export type StockListColumn = {
  id: number
  key: string
  label: string
  type: ColumnType
  options: string[]
  position: number
  hidden: boolean
  builtin: boolean
}

export type StockListResponse = {
  rows: StockListRow[]
  columns: StockListColumn[]
  screen_options: ScreenLabel[]
}

export async function getStockList(): Promise<StockListResponse> {
  return apiRequest<StockListResponse>('/list')
}

export async function patchStockListRow(
  symbol: string,
  field: string,
  value: string | boolean | number | null,
): Promise<StockListRow> {
  return apiRequest<StockListRow>(`/list/${symbol}`, {
    method: 'PATCH',
    body: JSON.stringify({ field, value }),
  })
}

export async function createStockListColumn(payload: {
  label: string
  type: ColumnType
  options?: string[]
}): Promise<StockListColumn> {
  return apiRequest<StockListColumn>('/list/columns', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateStockListColumn(
  columnId: number,
  payload: Partial<{ label: string; type: ColumnType; options: string[]; position: number; hidden: boolean }>,
): Promise<StockListColumn> {
  return apiRequest<StockListColumn>(`/list/columns/${columnId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteStockListColumn(columnId: number): Promise<void> {
  await apiRequest(`/list/columns/${columnId}`, { method: 'DELETE' })
}

export async function reorderStockListColumns(keys: string[]): Promise<StockListColumn[]> {
  return apiRequest<StockListColumn[]>('/list/columns/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ keys }),
  })
}
