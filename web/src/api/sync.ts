import { apiRequest } from './client'

export type SyncRun = {
  id: number
  mode: string
  scope: string
  status: string
  started_at: string
  finished_at: string | null
  processed: number
  updated: number
  failed: number
  total: number
  error: string | null
}

export type SyncRunItem = {
  id: number
  run_id: number
  symbol: string
  status: string
  rows: number
  window: string
  message: string
}

export type SyncRunDetail = {
  run: SyncRun
  items: SyncRunItem[]
}

export async function startSync(mode: 'full' | 'incremental', scope: 'universe' | 'watchlist'): Promise<SyncRun> {
  return apiRequest<SyncRun>('/admin/sync', {
    method: 'POST',
    body: JSON.stringify({ mode, scope }),
  })
}

export async function getSyncStatus(): Promise<SyncRun> {
  return apiRequest<SyncRun>('/admin/sync/status')
}

export async function getSyncRuns(): Promise<SyncRun[]> {
  return apiRequest<SyncRun[]>('/admin/sync/runs')
}

export async function getSyncRunDetail(runId: number): Promise<SyncRunDetail> {
  return apiRequest<SyncRunDetail>(`/admin/sync/runs/${runId}`)
}

export async function retryFailed(runId: number): Promise<SyncRun> {
  return apiRequest<SyncRun>(`/admin/sync/runs/${runId}/retry-failed`, {
    method: 'POST',
  })
}
