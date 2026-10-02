export type SectorChatEvent =
  | { type: 'meta'; sector: string; provider: string }
  | { type: 'token'; text: string }
  | { type: 'done' }
  | { type: 'cancelled' }
  | { type: 'error'; message: string }

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

export async function streamSectorChat(
  payload: { sector: string; question: string },
  handlers: {
    onEvent: (event: SectorChatEvent) => void
    signal?: AbortSignal
  },
): Promise<void> {
  const response = await fetch(`${API_BASE}/ai/sector-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: handlers.signal,
  })

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const body = (await response.json()) as { error?: { message?: string } }
      message = body.error?.message ?? message
    } catch {
      // ignore
    }
    throw new Error(message)
  }

  if (!response.body) {
    throw new Error('No response stream')
  }

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
        handlers.onEvent(JSON.parse(raw) as SectorChatEvent)
      } catch {
        // ignore malformed chunks
      }
    }
  }

  if (buffer.trim()) {
    const line = buffer
      .split('\n')
      .map((item) => item.trim())
      .find((item) => item.startsWith('data:'))
    if (line) {
      const raw = line.slice(5).trim()
      if (raw) {
        try {
          handlers.onEvent(JSON.parse(raw) as SectorChatEvent)
        } catch {
          // ignore
        }
      }
    }
  }
}
