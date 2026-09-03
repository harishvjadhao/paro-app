import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Eraser,
  MessageSquare,
  Pin,
  Sparkles,
  Square,
  X,
} from 'lucide-react'
import { streamSectorChat } from '../api/ai'
import { detectSymbols, renderSimpleMarkdown } from '../components/SimpleMarkdown'

type ChatMessage = {
  id: string
  role: 'user' | 'ai'
  text: string
  streaming?: boolean
}

type PinItem = {
  id: string
  text: string
  sector: string
  ts: number
}

const PINS_KEY = 'sec:pins'

function loadPins(): PinItem[] {
  try {
    const raw = localStorage.getItem(PINS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PinItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function savePins(pins: PinItem[]) {
  localStorage.setItem(PINS_KEY, JSON.stringify(pins))
}

const SUGGESTIONS = [
  'What’s driving breadth here?',
  'Who are the leaders and laggards?',
  'How does the weekly trend look?',
  'Any names reclaiming the 44 MA?',
]

type SectorAIPanelProps = {
  sector: string
  symbols: string[]
}

export function SectorAIPanel({ sector, symbols }: SectorAIPanelProps) {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [lastPrompt, setLastPrompt] = useState('')
  const [pinHint, setPinHint] = useState(false)
  const [pins, setPins] = useState<PinItem[]>(() => loadPins())
  const [pinCopied, setPinCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    savePins(pins)
  }, [pins])

  useEffect(() => {
    const box = boxRef.current
    if (box) {
      box.scrollTop = box.scrollHeight
    }
  }, [messages, busy, streaming])

  const jumpTo = (symbol: string) => {
    localStorage.setItem('ws:selected', symbol)
    navigate('/workspace')
  }

  const send = async (override?: string, isRetry = false) => {
    const question = (override ?? input).trim()
    if (!question || busy || streaming) return

    if (!isRetry) {
      setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text: question }])
      setInput('')
    }
    setBusy(true)
    setError('')
    setLastPrompt(question)
    setStreaming(false)

    const aiId = `a-${Date.now()}`
    const controller = new AbortController()
    abortRef.current = controller

    try {
      let started = false
      await streamSectorChat(
        { sector, question },
        {
          signal: controller.signal,
          onEvent: (event) => {
            if (event.type === 'token') {
              if (!started) {
                started = true
                setBusy(false)
                setStreaming(true)
                setMessages((prev) => [...prev, { id: aiId, role: 'ai', text: event.text, streaming: true }])
              } else {
                setMessages((prev) =>
                  prev.map((msg) => (msg.id === aiId ? { ...msg, text: msg.text + event.text } : msg)),
                )
              }
            } else if (event.type === 'done' || event.type === 'cancelled') {
              setStreaming(false)
              setBusy(false)
              setMessages((prev) => prev.map((msg) => (msg.id === aiId ? { ...msg, streaming: false } : msg)))
            } else if (event.type === 'error') {
              setError(event.message || 'AI request failed.')
              setStreaming(false)
              setBusy(false)
            }
          },
        },
      )
      setBusy(false)
      setStreaming(false)
      setMessages((prev) => prev.map((msg) => (msg.id === aiId ? { ...msg, streaming: false } : msg)))
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setStreaming(false)
        setBusy(false)
        return
      }
      setBusy(false)
      setStreaming(false)
      setError(err instanceof Error ? err.message : 'Could not reach the AI service.')
    } finally {
      abortRef.current = null
    }
  }

  const stop = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setStreaming(false)
    setBusy(false)
    setMessages((prev) => prev.map((msg) => (msg.streaming ? { ...msg, streaming: false } : msg)))
  }

  const clearChat = () => {
    stop()
    setMessages([])
    setError('')
  }

  const pinSelection = () => {
    const sel = (window.getSelection?.()?.toString() || '').trim()
    if (!sel) {
      setPinHint(true)
      window.setTimeout(() => setPinHint(false), 2800)
      return
    }
    setPins((prev) => [{ id: `p-${Date.now()}`, text: sel, sector, ts: Date.now() }, ...prev])
    setPinHint(false)
    window.getSelection()?.removeAllRanges()
  }

  const exportPins = async () => {
    const text = pins
      .map((pin) => `• ${pin.text}  (${pin.sector} · ${new Date(pin.ts).toLocaleString('en-IN')})`)
      .join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setPinCopied(true)
      window.setTimeout(() => setPinCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const movePin = (id: string, dir: -1 | 1) => {
    setPins((prev) => {
      const next = [...prev]
      const index = next.findIndex((item) => item.id === id)
      const swap = index + dir
      if (index < 0 || swap < 0 || swap >= next.length) return prev
      ;[next[index], next[swap]] = [next[swap], next[index]]
      return next
    })
  }

  return (
    <div className='sec-ai-layout'>
      <div className='sec-card sec-ai-panel'>
        <div className='sec-ai-head'>
          <div className='sec-card-title'>
            <Sparkles size={16} /> Ask AI · {sector}
          </div>
          {messages.length ? (
            <button type='button' className='sec-ai-clear' onClick={clearChat}>
              <Eraser size={13} /> Clear
            </button>
          ) : null}
        </div>
        <p className='sec-ai-hint'>Select any text in a reply, then click Pin to save it as a result.</p>

        <div className='sec-ai-messages' ref={boxRef}>
          {!messages.length && !busy ? (
            <div className='sec-ai-empty'>Ask about {sector} breadth, leaders, or what’s driving the move.</div>
          ) : null}

          {messages.map((message) => {
            const stocks = message.role === 'ai' ? detectSymbols(message.text, symbols) : []
            return (
              <div key={message.id} className={`sec-ai-msg ${message.role}`}>
                <div className='sec-ai-bubble'>
                  {message.role === 'user' ? (
                    <div>{message.text}</div>
                  ) : (
                    <>
                      <div className='sec-ai-md'>
                        {renderSimpleMarkdown(message.text)}
                        {message.streaming ? <span className='sec-ai-caret'>▍</span> : null}
                      </div>
                      {stocks.length ? (
                        <div className='sec-ai-stocks'>
                          {stocks.map((symbol) => (
                            <button key={symbol} type='button' onClick={() => jumpTo(symbol)}>
                              {symbol}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {!message.streaming ? (
                        <div className='sec-ai-pin-row'>
                          <button type='button' onMouseDown={(event) => event.preventDefault()} onClick={pinSelection}>
                            <Pin size={12} /> Pin selection
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            )
          })}

          {busy ? (
            <div className='sec-ai-msg ai'>
              <div className='sec-ai-bubble muted'>Analysing {sector}…</div>
            </div>
          ) : null}

          {error ? (
            <div className='sec-ai-error'>
              {error}{' '}
              <button type='button' onClick={() => void send(lastPrompt, true)}>
                Retry
              </button>
            </div>
          ) : null}
        </div>

        {pinHint ? <div className='sec-ai-pin-hint'>Select some text inside a reply first, then click Pin.</div> : null}

        {!messages.length ? (
          <div className='sec-ai-suggestions'>
            {SUGGESTIONS.map((text) => (
              <button key={text} type='button' onClick={() => void send(text)}>
                {text}
              </button>
            ))}
          </div>
        ) : null}

        <div className='sec-ai-composer'>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void send()
              }
            }}
            placeholder='Ask about this sector…'
            rows={2}
          />
          {streaming ? (
            <button type='button' className='sec-ai-stop' onClick={stop}>
              <Square size={13} /> Stop
            </button>
          ) : (
            <button type='button' className='sec-ai-send' disabled={!input.trim() || busy} onClick={() => void send()}>
              Send
            </button>
          )}
        </div>
      </div>

      <div className='sec-card sec-pins-panel'>
        <div className='sec-ai-head'>
          <div className='sec-card-title'>
            <Pin size={16} /> Pinned results
          </div>
          {pins.length ? (
            <button type='button' className='sec-ai-clear' onClick={() => void exportPins()}>
              <Copy size={12} /> {pinCopied ? 'Copied' : 'Export'}
            </button>
          ) : null}
        </div>
        {!pins.length ? (
          <div className='sec-ai-empty dashed'>
            <MessageSquare size={14} /> No pins yet. Highlight text in an AI reply and pin it.
          </div>
        ) : (
          <ul className='sec-pins-list'>
            {pins.map((pin) => (
              <li key={pin.id}>
                <div className='sec-pin-row'>
                  <span>{pin.text}</span>
                  <div className='sec-pin-actions'>
                    <button type='button' title='Move up' onClick={() => movePin(pin.id, -1)}>
                      <ChevronUp size={13} />
                    </button>
                    <button type='button' title='Move down' onClick={() => movePin(pin.id, 1)}>
                      <ChevronDown size={13} />
                    </button>
                    <button
                      type='button'
                      title='Remove'
                      onClick={() => setPins((prev) => prev.filter((item) => item.id !== pin.id))}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
                <div className='sec-pin-meta'>
                  {pin.sector} · {new Date(pin.ts).toLocaleString('en-IN')}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
