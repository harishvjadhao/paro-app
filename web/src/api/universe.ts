import { apiRequest } from './client'

export type UniverseStock = {
  id: number
  symbol: string
  company: string
  industry: string
  series: string
  isin: string
  yahoo_symbol: string
  active: boolean
  created_at: string
}

export type UniverseUploadPreviewRow = {
  symbol: string
  company: string
  industry: string
  series: string
  isin: string
  yahoo_symbol: string
}

export type UniverseUploadResponse = {
  total: number
  dup: number
  invalid: number
  mode: 'append' | 'replace'
  preview: UniverseUploadPreviewRow[]
  created_at: string
}

export type UniverseStatus = {
  active_stocks: number
  last_upload_at: string | null
}

export async function getUniverse(): Promise<UniverseStock[]> {
  return apiRequest<UniverseStock[]>('/universe')
}

export async function getUniverseStatus(): Promise<UniverseStatus> {
  return apiRequest<UniverseStatus>('/admin/universe/status')
}

export async function uploadUniverse(file: File, mode: 'append' | 'replace', confirm = false): Promise<UniverseUploadResponse> {
  const form = new FormData()
  form.append('file', file)
  form.append('mode', mode)
  form.append('confirm', String(confirm))

  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'}/admin/universe/upload`, {
    method: 'POST',
    body: form,
  })

  const payload = (await response.json()) as UniverseUploadResponse | { error?: { message?: string } }
  if (!response.ok) {
    throw new Error((payload as { error?: { message?: string } }).error?.message ?? 'Upload failed')
  }

  return payload as UniverseUploadResponse
}

export async function clearUniverse(): Promise<{ deleted: number }> {
  return apiRequest<{ deleted: number }>('/admin/universe', { method: 'DELETE' })
}
