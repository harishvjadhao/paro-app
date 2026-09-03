import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Copy,
  Highlighter,
  List,
  Search,
  Sparkles,
  Type,
} from 'lucide-react'
import {
  createHighlight,
  deleteHighlight,
  getProgress,
  listBookmarks,
  listBookPages,
  listHighlights,
  searchBook,
  setProgress,
  toggleBookmark,
  type BookBookmark,
  type BookCite,
  type BookDetail,
  type BookHighlight,
  type BookPage,
  type BookSearchHit,
} from '../api/library'
import { BookAskPanel } from './BookAskPanel'

type ReaderTheme = 'light' | 'sepia' | 'dark'
type FontFamily = 'serif' | 'sans'
type PageWidth = 'narrow' | 'normal' | 'wide'

type ReaderPrefs = {
  fontPx: number
  theme: ReaderTheme
  family: FontFamily
  width: PageWidth
}

const PREFS_KEY = 'paro.readerPrefs'

const THEME_STYLES: Record<ReaderTheme, { shell: string; page: string; text: string }> = {
  light: { shell: '#eef1f6', page: '#ffffff', text: '#1a1f2c' },
  sepia: { shell: '#e8dcc8', page: '#f4ead5', text: '#3b2f1f' },
  dark: { shell: '#12151c', page: '#1b2030', text: '#e7ebf5' },
}

const WIDTH_PX: Record<PageWidth, number> = {
  narrow: 560,
  normal: 668,
  wide: 920,
}

function loadPrefs(): ReaderPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return { fontPx: 18, theme: 'sepia', family: 'serif', width: 'normal' }
    const parsed = JSON.parse(raw) as Partial<ReaderPrefs>
    return {
      fontPx: typeof parsed.fontPx === 'number' ? Math.min(28, Math.max(14, parsed.fontPx)) : 18,
      theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : 'sepia',
      family: parsed.family === 'sans' ? 'sans' : 'serif',
      width: parsed.width === 'narrow' || parsed.width === 'wide' ? parsed.width : 'normal',
    }
  } catch {
    return { fontPx: 18, theme: 'sepia', family: 'serif', width: 'normal' }
  }
}

type SelectionPopover = {
  x: number
  y: number
  start: number
  end: number
  quote: string
}

type Props = {
  book: BookDetail
  onClose: () => void
}

export function BookReader({ book, onClose }: Props) {
  const pageRef = useRef<HTMLDivElement | null>(null)
  const textRef = useRef<HTMLDivElement | null>(null)
  const [pages, setPages] = useState<BookPage[]>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [bookmarks, setBookmarks] = useState<BookBookmark[]>([])
  const [highlights, setHighlights] = useState<BookHighlight[]>([])
  const [prefs, setPrefs] = useState<ReaderPrefs>(() => loadPrefs())
  const [panelOpen, setPanelOpen] = useState(false)
  const [askOpen, setAskOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [searchHits, setSearchHits] = useState<BookSearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [popover, setPopover] = useState<SelectionPopover | null>(null)
  const [flashId, setFlashId] = useState<number | null>(null)
  const [flashCite, setFlashCite] = useState<BookCite | null>(null)
  const [ready, setReady] = useState(false)

  const theme = THEME_STYLES[prefs.theme]
  const page = pages[pageIndex]
  const bookmarked = bookmarks.some((row) => row.page_index === pageIndex)
  const pageHighlights = useMemo(
    () => highlights.filter((row) => row.page_index === pageIndex).sort((a, b) => a.start_offset - b.start_offset),
    [highlights, pageIndex],
  )
  const pct = pages.length ? Math.round(((pageIndex + 1) / pages.length) * 100) : 0

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  }, [prefs])

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const [pageRows, progress, bm, hl] = await Promise.all([
            listBookPages(book.id),
            getProgress(book.id),
            listBookmarks(book.id),
            listHighlights(book.id),
          ])
          if (cancelled) return
          setPages(pageRows)
          setBookmarks(bm)
          setHighlights(hl)
          const max = Math.max(pageRows.length - 1, 0)
          setPageIndex(Math.min(Math.max(progress.page_index, 0), max))
          setReady(true)
        } catch (err) {
          if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to open reader.')
        }
      })()
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [book.id])

  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(() => {
      void setProgress(book.id, pageIndex).catch(() => undefined)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [book.id, pageIndex, ready])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (event.key === 'Escape') {
        setPopover(null)
        setPanelOpen(false)
        setSettingsOpen(false)
        return
      }
      if (typing) return
      if (event.key === 'ArrowLeft') setPageIndex((value) => Math.max(0, value - 1))
      if (event.key === 'ArrowRight') setPageIndex((value) => Math.min(pages.length - 1, value + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pages.length])

  useEffect(() => {
    if (!searchQ.trim()) {
      setSearchHits([])
      return
    }
    const timer = window.setTimeout(() => {
      void (async () => {
        setSearching(true)
        try {
          setSearchHits(await searchBook(book.id, searchQ.trim()))
        } catch {
          setSearchHits([])
        } finally {
          setSearching(false)
        }
      })()
    }, 250)
    return () => window.clearTimeout(timer)
  }, [book.id, searchQ])

  const jumpTo = (index: number) => {
    setPageIndex(Math.min(Math.max(index, 0), Math.max(pages.length - 1, 0)))
    setPanelOpen(false)
    setPopover(null)
  }

  const onCite = (cite: BookCite) => {
    jumpTo(cite.page_index)
    setFlashCite(cite)
    window.setTimeout(() => setFlashCite(null), 4500)
  }

  const onToggleBookmark = async () => {
    try {
      await toggleBookmark(book.id, pageIndex)
      setBookmarks(await listBookmarks(book.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bookmark failed.')
    }
  }

  const onExportHighlights = async () => {
    const lines = highlights
      .slice()
      .sort((a, b) => a.page_index - b.page_index || a.start_offset - b.start_offset)
      .map((row) => `p.${row.page_index + 1}  "${row.quote.replace(/\s+/g, ' ').trim()}"`)
    const text = `Highlights — ${book.title}\n\n${lines.join('\n') || 'No highlights yet.'}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setError('Could not copy highlights.')
    }
  }

  const onMouseUp = () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !pageRef.current || !textRef.current) {
      setPopover(null)
      return
    }
    if (!textRef.current.contains(selection.anchorNode) || !textRef.current.contains(selection.focusNode)) {
      setPopover(null)
      return
    }
    const quote = selection.toString()
    if (quote.trim().length <= 2 || !page) {
      setPopover(null)
      return
    }
    const range = selection.getRangeAt(0)
    const full = page.text
    // Measure the selection's true start offset within the rendered text node so
    // duplicate substrings resolve to the exact selected occurrence.
    let start: number
    try {
      const preRange = range.cloneRange()
      preRange.selectNodeContents(textRef.current)
      preRange.setEnd(range.startContainer, range.startOffset)
      start = preRange.toString().length
    } catch {
      start = full.indexOf(quote)
    }
    let end = start + quote.length
    if (start < 0 || full.slice(start, end) !== quote) {
      const fallback = full.indexOf(quote)
      if (fallback < 0) {
        setPopover(null)
        return
      }
      start = fallback
      end = fallback + quote.length
    }
    const rect = range.getBoundingClientRect()
    setPopover({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      start,
      end,
      quote,
    })
  }

  const saveHighlight = async () => {
    if (!popover) return
    try {
      await createHighlight(book.id, {
        page_index: pageIndex,
        start_offset: popover.start,
        end_offset: popover.end,
        quote: popover.quote,
      })
      setHighlights(await listHighlights(book.id))
      setPopover(null)
      window.getSelection()?.removeAllRanges()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Highlight failed.')
    }
  }

  const removeHighlight = async (highlightId: number) => {
    try {
      await deleteHighlight(book.id, highlightId)
      setHighlights(await listHighlights(book.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete highlight failed.')
    }
  }

  const renderPageBody = () => {
    const text = page?.text || 'No text on this page.'
    type Span = { start: number; end: number; kind: 'hl' | 'cite'; id: string; color?: string }
    const spans: Span[] = pageHighlights.map((hl) => ({
      start: Math.max(0, Math.min(hl.start_offset, text.length)),
      end: Math.max(0, Math.min(hl.end_offset, text.length)),
      kind: 'hl',
      id: `hl-${hl.id}`,
      color: hl.color,
    }))

    if (flashCite && flashCite.page_index === pageIndex) {
      let start = flashCite.char_start
      let end = flashCite.char_end
      const exact = text.slice(start, end)
      if (exact !== flashCite.quote) {
        const found = text.indexOf(flashCite.quote)
        if (found >= 0) {
          start = found
          end = found + flashCite.quote.length
        }
      }
      spans.push({
        start: Math.max(0, Math.min(start, text.length)),
        end: Math.max(0, Math.min(end, text.length)),
        kind: 'cite',
        id: 'cite-flash',
      })
    }

    spans.sort((a, b) => a.start - b.start || b.end - a.end)
    if (!spans.length) return text

    const nodes: ReactNode[] = []
    let cursor = 0
    for (const span of spans) {
      if (span.end <= cursor) continue
      const start = Math.max(span.start, cursor)
      const end = span.end
      if (start > cursor) nodes.push(text.slice(cursor, start))
      if (span.kind === 'hl') {
        const hlId = Number(span.id.replace('hl-', ''))
        nodes.push(
          <mark
            key={span.id + start}
            className={`reader-mark ${flashId === hlId ? 'flash' : ''}`}
            style={{ background: `${span.color || '#EA9D00'}55` }}
          >
            {text.slice(start, end)}
          </mark>,
        )
      } else {
        nodes.push(
          <mark key={span.id + start} className='reader-mark cite-flash'>
            {text.slice(start, end)}
          </mark>,
        )
      }
      cursor = end
    }
    if (cursor < text.length) nodes.push(text.slice(cursor))
    return nodes
  }

  return (
    <section className='screen reader-screen' style={{ background: theme.shell }}>
      <div className='reader-top'>
        <button type='button' className='reader-icon-btn' onClick={onClose} title='Back to library'>
          <ArrowLeft size={16} />
        </button>
        <div className='reader-title-block'>
          <strong>{book.title}</strong>
          <span>
            {book.author || 'Unknown author'} · {book.kind === 'scanned' ? 'Scanned' : 'Text'} PDF
          </span>
        </div>
        <div className='reader-font-pair'>
          <button type='button' onClick={() => setPrefs((p) => ({ ...p, fontPx: Math.max(14, p.fontPx - 1) }))}>
            A
          </button>
          <button type='button' className='lg' onClick={() => setPrefs((p) => ({ ...p, fontPx: Math.min(28, p.fontPx + 1) }))}>
            A
          </button>
        </div>
        <div className='reader-theme-pair'>
          {(['light', 'sepia', 'dark'] as ReaderTheme[]).map((value) => (
            <button
              key={value}
              type='button'
              className={`reader-theme-swatch ${value} ${prefs.theme === value ? 'active' : ''}`}
              title={value}
              onClick={() => setPrefs((p) => ({ ...p, theme: value }))}
            />
          ))}
        </div>
        <button
          type='button'
          className={`reader-icon-btn ${settingsOpen ? 'active' : ''}`}
          title='Reading settings'
          onClick={() => {
            setSettingsOpen((value) => !value)
            setPanelOpen(false)
          }}
        >
          <Type size={16} />
        </button>
        <button
          type='button'
          className={`reader-icon-btn ${bookmarked ? 'active' : ''}`}
          title='Bookmark this page'
          onClick={() => void onToggleBookmark()}
        >
          <Bookmark size={16} />
        </button>
        <button
          type='button'
          className={`reader-icon-btn ${panelOpen ? 'active' : ''}`}
          title='Contents, bookmarks & notes'
          onClick={() => {
            setPanelOpen((value) => !value)
            setSettingsOpen(false)
            setAskOpen(false)
          }}
        >
          <List size={16} />
        </button>
        <button
          type='button'
          className={`reader-ask-toggle ${askOpen ? 'active' : ''}`}
          title='Ask this book'
          onClick={() => {
            setAskOpen((value) => !value)
            setPanelOpen(false)
            setSettingsOpen(false)
          }}
        >
          <Sparkles size={15} /> Ask
        </button>
      </div>

      {settingsOpen ? (
        <div className='reader-settings'>
          <div className='reader-settings-label'>Font family</div>
          <div className='reader-seg'>
            <button type='button' className={prefs.family === 'serif' ? 'active' : ''} onClick={() => setPrefs((p) => ({ ...p, family: 'serif' }))}>
              Serif
            </button>
            <button type='button' className={prefs.family === 'sans' ? 'active' : ''} onClick={() => setPrefs((p) => ({ ...p, family: 'sans' }))}>
              Sans
            </button>
          </div>
          <div className='reader-settings-label'>Page width</div>
          <div className='reader-seg'>
            {(['narrow', 'normal', 'wide'] as PageWidth[]).map((value) => (
              <button
                key={value}
                type='button'
                className={prefs.width === value ? 'active' : ''}
                onClick={() => setPrefs((p) => ({ ...p, width: value }))}
              >
                {value[0].toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <div className='reader-error'>{error}</div> : null}

      <div className='reader-body'>
        {panelOpen ? (
          <aside className='reader-panel'>
            <div className='reader-search'>
              <Search size={14} />
              <input
                value={searchQ}
                onChange={(event) => setSearchQ(event.target.value)}
                placeholder='Search in book…'
              />
            </div>

            {searchQ.trim() ? (
              <div className='reader-panel-section'>
                <div className='reader-panel-head'>Search</div>
                {searching ? <div className='reader-panel-empty'>Searching…</div> : null}
                {!searching && !searchHits.length ? <div className='reader-panel-empty'>No matches in this book.</div> : null}
                {searchHits.map((hit, index) => (
                  <button key={`${hit.page_index}-${hit.match_offset}-${index}`} type='button' className='reader-panel-item' onClick={() => jumpTo(hit.page_index)}>
                    <strong>{hit.chapter ? `${hit.chapter} · p.${hit.page_index + 1}` : `p.${hit.page_index + 1}`}</strong>
                    <span>{hit.snippet}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {bookmarks.length ? (
              <div className='reader-panel-section'>
                <div className='reader-panel-head'>Bookmarks</div>
                {bookmarks.map((bm) => (
                  <button key={bm.id} type='button' className='reader-panel-item' onClick={() => jumpTo(bm.page_index)}>
                    <Bookmark size={13} />
                    <span>
                      p.{bm.page_index + 1} · {bm.label}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className='reader-panel-section'>
              <div className='reader-panel-head'>Contents</div>
              {book.toc.map((entry) => (
                <button
                  key={`${entry.chapter}-${entry.page_index}`}
                  type='button'
                  className={`reader-panel-item ${page?.chapter === entry.chapter ? 'active' : ''}`}
                  onClick={() => jumpTo(entry.page_index)}
                >
                  {entry.chapter}
                </button>
              ))}
              {!book.toc.length ? <div className='reader-panel-empty'>No chapters detected.</div> : null}
            </div>

            <div className='reader-panel-section'>
              <div className='reader-panel-head'>
                <span>Highlights</span>
                <button type='button' className='reader-export' onClick={() => void onExportHighlights()}>
                  <Copy size={12} /> {copied ? 'Copied' : 'Export'}
                </button>
              </div>
              {highlights.map((hl) => (
                <div key={hl.id} className='reader-hl-item'>
                  <button
                    type='button'
                    className='reader-panel-item'
                    onClick={() => {
                      jumpTo(hl.page_index)
                      setFlashId(hl.id)
                      window.setTimeout(() => setFlashId(null), 1200)
                    }}
                  >
                    <strong>p.{hl.page_index + 1}</strong>
                    <span>{hl.quote}</span>
                  </button>
                  <button type='button' className='reader-hl-del' onClick={() => void removeHighlight(hl.id)}>
                    ×
                  </button>
                </div>
              ))}
              {!highlights.length ? <div className='reader-panel-empty'>Select text on a page to highlight.</div> : null}
            </div>
          </aside>
        ) : null}

        <div className='reader-stage'>
          <article
            ref={pageRef}
            className='reader-page'
            style={{
              maxWidth: WIDTH_PX[prefs.width],
              background: theme.page,
              color: theme.text,
              fontFamily: prefs.family === 'serif' ? 'Georgia, "Times New Roman", serif' : 'Segoe UI, system-ui, sans-serif',
              fontSize: prefs.fontPx,
              lineHeight: `${Math.round(prefs.fontPx * 1.65)}px`,
            }}
            onMouseUp={onMouseUp}
          >
            <div className='reader-chapter'>{page?.chapter || '—'}</div>
            <div className='reader-text' ref={textRef}>{renderPageBody()}</div>
          </article>
        </div>

        {askOpen ? (
          <BookAskPanel book={book} pageIndex={pageIndex} onClose={() => setAskOpen(false)} onCite={onCite} />
        ) : null}
      </div>

      <div className='reader-footer'>
        <button type='button' disabled={pageIndex <= 0} onClick={() => setPageIndex((value) => value - 1)}>
          <ChevronLeft size={15} /> Prev
        </button>
        <div className='reader-progress'>
          <div style={{ width: `${pct}%` }} />
        </div>
        <span>
          Page {pageIndex + 1} of {Math.max(pages.length, 1)}
        </span>
        <button type='button' disabled={pageIndex >= pages.length - 1} onClick={() => setPageIndex((value) => value + 1)}>
          Next <ChevronRight size={15} />
        </button>
      </div>

      {popover ? (
        <div className='reader-sel-popover' style={{ left: popover.x, top: popover.y }}>
          <button type='button' onClick={() => void saveHighlight()}>
            <Highlighter size={14} /> Highlight
          </button>
        </div>
      ) : null}
    </section>
  )
}
