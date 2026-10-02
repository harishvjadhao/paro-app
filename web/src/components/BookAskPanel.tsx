import { useEffect, useRef, useState } from 'react'
import { BookMarked, BookOpenText, FileSearch, Sparkles, Square, X } from 'lucide-react'
import {
  streamBookAsk,
  streamExplainPage,
  streamSummarizeBook,
  streamSummarizeChapter,
  type BookAskEvent,
  type BookCite,
  type BookDetail,
} from '../api/library'
import { renderSimpleMarkdown } from './SimpleMarkdown'

type ChatMessage = {
  id: string
  role: 'user' | 'ai'
  text: string
  streaming?: boolean
  cites?: BookCite[]
  retrieving?: boolean
}

type Props = {
  book: BookDetail
  pageIndex: number
  onClose: () => void
  onCite: (cite: BookCite) => void
}

export function BookAskPanel({ book, pageIndex, onClose, onCite }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const lastRunRef = useRef<{
    label: string
    starter: (handlers: { onEvent: (event: BookAskEvent) => void; signal?: AbortSignal }) => Promise<void>
  } | null>(null)

  useEffect(() => {
    const box = boxRef.current
    if (box) box.scrollTop = box.scrollHeight
  }, [messages, busy])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const runStream = async (
    label: string,
    starter: (handlers: { onEvent: (event: BookAskEvent) => void; signal?: AbortSignal }) => Promise<void>,
  ) => {
    if (busy) return
    lastRunRef.current = { label, starter }
    setBusy(true)
    setError('')
    const aiId = `a-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', text: label },
      { id: aiId, role: 'ai', text: '', streaming: true, retrieving: true, cites: [] },
    ])

    const controller = new AbortController()
    abortRef.current = controller

    try {
      await starter({
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === 'meta') {
            setMessages((prev) =>
              prev.map((row) => (row.id === aiId ? { ...row, retrieving: false } : row)),
            )
          } else if (event.type === 'token') {
            setMessages((prev) =>
              prev.map((row) =>
                row.id === aiId
                  ? { ...row, text: row.text + event.text, streaming: true, retrieving: false }
                  : row,
              ),
            )
          } else if (event.type === 'cites') {
            setMessages((prev) =>
              prev.map((row) => (row.id === aiId ? { ...row, cites: event.cites } : row)),
            )
          } else if (event.type === 'error') {
            setError(event.message)
          } else if (event.type === 'done' || event.type === 'cancelled') {
            setMessages((prev) =>
              prev.map((row) => (row.id === aiId ? { ...row, streaming: false, retrieving: false } : row)),
            )
          }
        },
      })
      setMessages((prev) =>
        prev.map((row) => (row.id === aiId ? { ...row, streaming: false, retrieving: false } : row)),
      )
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'Ask failed.')
        setMessages((prev) => prev.filter((row) => row.id !== aiId))
      }
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  const ask = async (override?: string) => {
    const question = (override ?? input).trim()
    if (!question || busy) return
    if (!override) setInput('')
    await runStream(question, (handlers) => streamBookAsk(book.id, { question }, handlers))
  }

  const stop = () => {
    abortRef.current?.abort()
    setBusy(false)
  }

  const retry = () => {
    const last = lastRunRef.current
    if (!last || busy) return
    void runStream(last.label, last.starter)
  }

  return (
    <aside className='reader-ask'>
      <div className='reader-ask-head'>
        <strong>
          <Sparkles size={14} /> Ask this book
        </strong>
        <button type='button' onClick={onClose} title='Close'>
          <X size={15} />
        </button>
      </div>

      <div className='reader-ask-log' ref={boxRef}>
        {!messages.length ? (
          <div className='reader-ask-empty'>
            Ask anything about this book. Answers retrieve the most relevant passages and cite pages — tap a citation to jump and flash-highlight.
          </div>
        ) : null}

        {!messages.length && book.suggestions.length ? (
          <div className='reader-ask-suggestions'>
            <div className='reader-ask-suggest-head'>Try asking</div>
            {book.suggestions.map((question) => (
              <button key={question} type='button' disabled={busy} onClick={() => void ask(question)}>
                {question}
              </button>
            ))}
          </div>
        ) : null}

        {messages.map((message) => (
          <div key={message.id} className={`reader-ask-msg ${message.role}`}>
            {message.role === 'user' ? (
              <div>{message.text}</div>
            ) : (
              <>
                {message.retrieving ? <div className='reader-ask-retrieving'>Retrieving passages…</div> : null}
                <div className='reader-ask-answer'>
                  {renderSimpleMarkdown(message.text)}
                  {message.streaming ? <span className='reader-ask-caret' /> : null}
                </div>
                {message.cites?.length && !message.streaming ? (
                  <div className='reader-ask-cites'>
                    {message.cites.map((cite) => (
                      <button key={`${cite.page_index}-${cite.char_start}`} type='button' onClick={() => onCite(cite)}>
                        <BookOpenText size={11} /> p.{cite.page_index + 1}
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
        ))}
      </div>

      {error ? (
        <div className='reader-ask-error'>
          <span>{error}</span>
          {lastRunRef.current && !busy ? (
            <button type='button' onClick={retry}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      <div className='reader-ask-actions'>
        <button
          type='button'
          disabled={busy}
          onClick={() => void runStream('Explain this page', (h) => streamExplainPage(book.id, pageIndex, h))}
        >
          <FileSearch size={13} /> Explain page
        </button>
        <button
          type='button'
          disabled={busy}
          onClick={() =>
            void runStream('Summarize this chapter', (h) => streamSummarizeChapter(book.id, { page_index: pageIndex }, h))
          }
        >
          <BookMarked size={13} /> Summarize chapter
        </button>
        <button
          type='button'
          disabled={busy}
          onClick={() => void runStream('Summarize book', (h) => streamSummarizeBook(book.id, h))}
        >
          <BookOpenText size={13} /> Summarize book
        </button>
      </div>

      <div className='reader-ask-compose'>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder='Ask about this book…'
          onKeyDown={(event) => {
            if (event.key === 'Enter') void ask()
          }}
          disabled={busy}
        />
        {busy ? (
          <button type='button' className='stop' onClick={stop}>
            <Square size={13} /> Stop
          </button>
        ) : (
          <button type='button' className='send' disabled={!input.trim()} onClick={() => void ask()}>
            Send
          </button>
        )}
      </div>
    </aside>
  )
}
