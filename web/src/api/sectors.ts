import { apiRequest } from './client'

export type SectorSummary = {
  name: string
  total: number
  above: number
  breadth: number
  avg_pct_vs_ma: number
  avg8: number
  momentum: number
  rotation_x: number
  rotation_y: number
}

export type SectorConstituent = {
  symbol: string
  company: string
  close: number
  ma44: number | null
  pct_vs_ma44: number
  above_ma44: boolean
  sparkline: number[]
}

export type WeeklyBreadthPoint = {
  label: string
  pct: number
  avg_above: number
}

export type SectorDetail = {
  name: string
  total: number
  above: number
  below: number
  breadth: number
  avg_pct_vs_ma: number
  advancers: number
  decliners: number
  avg8: number
  momentum: number
  leader: SectorConstituent | null
  laggard: SectorConstituent | null
  constituents: SectorConstituent[]
  weekly_trend: WeeklyBreadthPoint[]
  rotation_x: number
  rotation_y: number
}

export type SectorCompareSeries = {
  name: string
  color: string
  points: WeeklyBreadthPoint[]
  selected: boolean
}

export type SectorCompareResponse = {
  sectors: SectorCompareSeries[]
  a: string | null
  b: string | null
}

export async function getSectors(): Promise<{ sectors: SectorSummary[] }> {
  return apiRequest('/sectors')
}

export async function getSectorDetail(sector: string): Promise<SectorDetail> {
  return apiRequest(`/sectors/${encodeURIComponent(sector)}`)
}

export async function compareSectors(a?: string, b?: string): Promise<SectorCompareResponse> {
  const params = new URLSearchParams()
  if (a) params.set('a', a)
  if (b) params.set('b', b)
  const query = params.toString()
  return apiRequest(`/sectors/compare${query ? `?${query}` : ''}`)
}
