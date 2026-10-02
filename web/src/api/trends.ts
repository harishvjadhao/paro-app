import { apiRequest } from './client'

export type TrendWeek = {
  index: number
  label: string
  end_date: string
}

export type TrendCell = {
  week_index: number
  pct: number
  avg_above: number
  total: number
}

export type TrendSectorRow = {
  name: string
  total: number
  cells: TrendCell[]
  avg: number
}

export type WeeklyTrendsResponse = {
  weeks: TrendWeek[]
  sectors: TrendSectorRow[]
  summary: string
}

export type TrendDrillStock = {
  symbol: string
  company: string
  pct_vs_ma44: number
  above_ma44: boolean
  week_above_share: number
  flipped: boolean
}

export type TrendDrillResponse = {
  sector: string
  week_index: number
  week_label: string
  end_date: string
  pct: number
  avg_above: number
  total: number
  above_count: number
  stocks: TrendDrillStock[]
}

export async function getWeeklyTrends(): Promise<WeeklyTrendsResponse> {
  return apiRequest('/trends/weekly')
}

export async function getWeeklyTrendDrill(sector: string, weekIndex: number): Promise<TrendDrillResponse> {
  return apiRequest(`/trends/weekly/${encodeURIComponent(sector)}/${weekIndex}`)
}
