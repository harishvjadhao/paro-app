import { apiRequest } from './client'

export type BookShelfItem = {
  id: number
  title: string
  author: string
  subtitle: string
  tag: string
  spine_color: string
  kind: 'text' | 'scanned'
  status: string
  page_count: number
  chunk_count: number
  token_count: number
  ocr_confidence: number | null
  created_at: string
  progress_pct: number
}

export type IngestionReport = {
  pages: number
  chunks: number
  tokens: number
  ocr_confidence: number | null
}

export type IngestionJob = {
  id: number
  book_id: number
  state: string
  pct: number
  stage: string
  error: string | null
  report: IngestionReport | null
  started_at: string
  finished_at: string | null
}

export type BookDetail = {
  id: number
  title: string
  author: string
  subtitle: string
  tag: string
  spine_color: string
  kind: 'text' | 'scanned'
  status: string
  page_count: number
  chunk_count: number
  token_count: number
  ocr_confidence: number | null
  source_filename: string
  created_at: string
  toc: { chapter: string; page_index: number }[]
  suggestions: string[]
  report: IngestionReport | null
}

export type BookPage = {
  page_index: number
  chapter: string
  text: string
}

export type ReadingProgress = {
  book_id: number
  page_index: number
  updated_at: string | null
}

export type BookBookmark = {
  id: number
  book_id: number
  page_index: number
  label: string
  created_at: string
}

export type BookHighlight = {
  id: number
  book_id: number
  page_index: number
  start_offset: number
  end_offset: number
  quote: string
  color: string
  created_at: string
}

export type BookSearchHit = {
  page_index: number
  chapter: string
  snippet: string
  match_offset: number
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

export async function listBooks(): Promise<BookShelfItem[]> {
  return apiRequest<BookShelfItem[]>('/library/books')
}

export async function getBook(bookId: number): Promise<BookDetail> {
  return apiRequest<BookDetail>(`/library/books/${bookId}`)
}

export async function renameBook(bookId: number, title: string): Promise<BookDetail> {
  return apiRequest<BookDetail>(`/library/books/${bookId}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  })
}

export async function deleteBook(bookId: number): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>(`/library/books/${bookId}`, { method: 'DELETE' })
}

export async function listBookPages(bookId: number, from?: number, to?: number): Promise<BookPage[]> {
  const params = new URLSearchParams()
  if (from != null) params.set('from', String(from))
  if (to != null) params.set('to', String(to))
  const qs = params.toString()
  return apiRequest<BookPage[]>(`/library/books/${bookId}/pages${qs ? `?${qs}` : ''}`)
}

export async function getIngestionJob(jobId: number): Promise<IngestionJob> {
  return apiRequest<IngestionJob>(`/library/jobs/${jobId}`)
}

export async function uploadBook(file: File, kind?: 'text' | 'scanned'): Promise<{ book_id: number; job_id: number }> {
  const form = new FormData()
  form.append('file', file)
  if (kind) form.append('kind', kind)

  const response = await fetch(`${API_BASE}/library/books/upload`, {
    method: 'POST',
    body: form,
  })
  const payload = (await response.json()) as { book_id: number; job_id: number } | { error?: { message?: string } }
  if (!response.ok) {
    throw new Error((payload as { error?: { message?: string } }).error?.message ?? 'Upload failed')
  }
  return payload as { book_id: number; job_id: number }
}

export async function getProgress(bookId: number): Promise<ReadingProgress> {
  return apiRequest<ReadingProgress>(`/library/books/${bookId}/progress`)
}

export async function setProgress(bookId: number, pageIndex: number): Promise<ReadingProgress> {
  return apiRequest<ReadingProgress>(`/library/books/${bookId}/progress`, {
    method: 'PUT',
    body: JSON.stringify({ page_index: pageIndex }),
  })
}

export async function listBookmarks(bookId: number): Promise<BookBookmark[]> {
  return apiRequest<BookBookmark[]>(`/library/books/${bookId}/bookmarks`)
}

export async function toggleBookmark(bookId: number, pageIndex: number): Promise<{ bookmarked: boolean }> {
  return apiRequest<{ bookmarked: boolean }>(`/library/books/${bookId}/bookmarks/toggle?page_index=${pageIndex}`, {
    method: 'POST',
  })
}

export async function listHighlights(bookId: number): Promise<BookHighlight[]> {
  return apiRequest<BookHighlight[]>(`/library/books/${bookId}/highlights`)
}

export async function createHighlight(
  bookId: number,
  payload: { page_index: number; start_offset: number; end_offset: number; quote: string; color?: string },
): Promise<BookHighlight> {
  return apiRequest<BookHighlight>(`/library/books/${bookId}/highlights`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function deleteHighlight(bookId: number, highlightId: number): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>(`/library/books/${bookId}/highlights/${highlightId}`, { method: 'DELETE' })
}

export async function searchBook(bookId: number, q: string): Promise<BookSearchHit[]> {
  const params = new URLSearchParams({ q })
  return apiRequest<BookSearchHit[]>(`/library/books/${bookId}/search?${params}`)
}

export type BookCite = {
  page_index: number
  chapter: string
  quote: string
  char_start: number
  char_end: number
}

export type BookAskEvent =
  | { type: 'meta'; retrieved: { chunk_id: number; page_index: number; chapter: string; score: number }[]; provider: string }
  | { type: 'token'; text: string }
  | { type: 'cites'; cites: BookCite[] }
  | { type: 'done'; finish?: string }
  | { type: 'cancelled' }
  | { type: 'error'; message: string }

async function streamLibrarySse(
  path: string,
  body: unknown,
  handlers: { onEvent: (event: BookAskEvent) => void; signal?: AbortSignal },
): Promise<void> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    signal: handlers.signal,
  })
  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const payload = (await response.json()) as { error?: { message?: string } }
      message = payload.error?.message ?? message
    } catch {
      // ignore
    }
    throw new Error(message)
  }
  if (!response.body) throw new Error('No response stream')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      const line = part
        .split('\n')
        .map((item) => item.trim())
        .find((item) => item.startsWith('data:'))
      if (!line) continue
      const raw = line.slice(5).trim()
      if (!raw) continue
      try {
        handlers.onEvent(JSON.parse(raw) as BookAskEvent)
      } catch {
        // ignore
      }
    }
  }
}

export async function streamBookAsk(
  bookId: number,
  payload: { question: string; top_k?: number },
  handlers: { onEvent: (event: BookAskEvent) => void; signal?: AbortSignal },
): Promise<void> {
  return streamLibrarySse(`/library/books/${bookId}/ask`, payload, handlers)
}

export async function streamExplainPage(
  bookId: number,
  pageIndex: number,
  handlers: { onEvent: (event: BookAskEvent) => void; signal?: AbortSignal },
): Promise<void> {
  return streamLibrarySse(`/library/books/${bookId}/explain-page`, { page_index: pageIndex }, handlers)
}

export async function streamSummarizeChapter(
  bookId: number,
  payload: { page_index?: number; chapter?: string },
  handlers: { onEvent: (event: BookAskEvent) => void; signal?: AbortSignal },
): Promise<void> {
  return streamLibrarySse(`/library/books/${bookId}/summarize-chapter`, payload, handlers)
}

export async function streamSummarizeBook(
  bookId: number,
  handlers: { onEvent: (event: BookAskEvent) => void; signal?: AbortSignal },
): Promise<void> {
  return streamLibrarySse(`/library/books/${bookId}/summarize-book`, {}, handlers)
}
