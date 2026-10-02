import { useEffect, useRef, useState } from 'react'
import { Download, Trash2, Upload, X } from 'lucide-react'
import {
  createTrade,
  deleteTrade,
  exportJournalCsv,
  getJournalAnalytics,
  getJournalPositions,
  importJournalCsv,
  listTrades,
  previewCharges,
  updateTrade,
  type ChargeBreakdown,
  type JournalAnalytics,
  type PositionsResponse,
  type Segment,
  type Trade,
  type TradeListResponse,
} from '../api/journal'
import { getStockCandles, type CandleItem, type ChartMarker, type PriceLevel } from '../api/workspace'
import { PriceChart } from '../components/PriceChart'
import { getDefaultSegment } from '../theme/prefs'

function money(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  const sign = value < 0 ? '-' : ''
  return `${sign}₹${Math.abs(value).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
}

function pnlClass(value: number | null | undefined): string {
  if (value == null) return ''
  return value >= 0 ? 'pos' : 'neg'
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type FormState = {
  symbol: string
  segment: Segment
  qty: string
  buy: string
  sell: string
  entryDate: string
  exitDate: string
  tags: string
  notes: string
}

const emptyForm = (): FormState => ({
  symbol: '',
  segment: getDefaultSegment(),
  qty: '',
  buy: '',
  sell: '',
  entryDate: todayISO(),
  exitDate: '',
  tags: '',
  notes: '',
})

export function JournalScreen() {
  const [data, setData] = useState<TradeListResponse | null>(null)
  const [analytics, setAnalytics] = useState<JournalAnalytics | null>(null)
  const [positions, setPositions] = useState<PositionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterQ, setFilterQ] = useState('')
  const [filterSeg, setFilterSeg] = useState<'All' | Segment>('All')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [form, setForm] = useState<FormState>(emptyForm)
  const [preview, setPreview] = useState<ChargeBreakdown | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editNotes, setEditNotes] = useState('')
  const [chartTrade, setChartTrade] = useState<Trade | null>(null)
  const [chartBars, setChartBars] = useState<CandleItem[]>([])
  const [chartStyle, setChartStyle] = useState<'candle' | 'line'>('candle')
  const [chartLoading, setChartLoading] = useState(false)
  const importRef = useRef<HTMLInputElement | null>(null)
  const equityRef = useRef<HTMLCanvasElement | null>(null)

  const reload = async (
    q = filterQ,
    segment = filterSeg,
    from = filterFrom,
    to = filterTo,
  ) => {
    setLoading(true)
    setError('')
    try {
      const [trades, analyticsPayload, positionsPayload] = await Promise.all([
        listTrades({
          q: q || undefined,
          segment: segment === 'All' ? undefined : segment,
          from: from || undefined,
          to: to || undefined,
        }),
        getJournalAnalytics(),
        getJournalPositions(),
      ])
      setData(trades)
      setAnalytics(analyticsPayload)
      setPositions(positionsPayload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load journal.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload()
    }, 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload(filterQ, filterSeg, filterFrom, filterTo)
    }, 300)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterQ, filterFrom, filterTo])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        const qty = Number(form.qty)
        const buy = Number(form.buy)
        const sell = form.sell.trim() === '' ? null : Number(form.sell)
        if (!qty || !buy || sell == null || Number.isNaN(sell)) {
          setPreview(null)
          return
        }
        try {
          const charges = await previewCharges({
            segment: form.segment,
            qty,
            entry_price: buy,
            exit_price: sell,
          })
          setPreview(charges)
        } catch {
          setPreview(null)
        }
      })()
    }, 180)
    return () => window.clearTimeout(timer)
  }, [form.segment, form.qty, form.buy, form.sell])

  useEffect(() => {
    const canvas = equityRef.current
    if (!canvas || !analytics?.equity_curve.length) {
      return
    }
    const points = analytics.equity_curve
    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (!width || !height) {
      return
    }
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    const values = points.map((point) => point.cumulative)
    let hi = Math.max(...values, 0)
    let lo = Math.min(...values, 0)
    if (hi === lo) {
      hi += 1
      lo -= 1
    }
    const pad = 8
    const plotW = width - pad * 2
    const plotH = height - pad * 2
    const cx = (index: number) => pad + (index / Math.max(points.length - 1, 1)) * plotW
    const cy = (value: number) => pad + (1 - (value - lo) / (hi - lo)) * plotH
    ctx.strokeStyle = '#CDD2D8'
    ctx.beginPath()
    ctx.moveTo(pad, cy(0))
    ctx.lineTo(width - pad, cy(0))
    ctx.stroke()
    ctx.beginPath()
    points.forEach((point, index) => {
      const x = cx(index)
      const y = cy(point.cumulative)
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    const last = values[values.length - 1] ?? 0
    ctx.strokeStyle = last >= 0 ? '#12A053' : '#DC3545'
    ctx.lineWidth = 2
    ctx.stroke()
  }, [analytics])

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2200)
  }

  const onAdd = async () => {
    const qty = Number(form.qty)
    const buy = Number(form.buy)
    const sell = form.sell.trim() === '' ? null : Number(form.sell)
    if (!form.symbol.trim() || !qty || !buy) {
      return
    }
    setBusy(true)
    try {
      await createTrade({
        symbol: form.symbol.trim().toUpperCase(),
        segment: form.segment,
        qty,
        entry_price: buy,
        entry_date: form.entryDate || todayISO(),
        exit_price: sell,
        exit_date: sell == null ? null : form.exitDate || todayISO(),
        tags: form.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        notes: form.notes.trim(),
      })
      setForm(emptyForm())
      setPreview(null)
      await reload()
      showToast('Trade added')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add trade.')
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async (id: number) => {
    setBusy(true)
    try {
      await deleteTrade(id)
      await reload()
      showToast('Trade deleted')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.')
    } finally {
      setBusy(false)
    }
  }

  const onSaveNotes = async (id: number) => {
    try {
      await updateTrade(id, { notes: editNotes.trim() })
      setEditId(null)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notes.')
    }
  }

  const onExport = async () => {
    try {
      const csv = await exportJournalCsv()
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'paro-journal.csv'
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.')
    }
  }

  const onImport = async (file: File | null) => {
    if (!file) return
    setBusy(true)
    try {
      const result = await importJournalCsv(file)
      await reload()
      showToast(`Imported ${result.imported} trade${result.imported === 1 ? '' : 's'}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  const openChart = async (trade: Trade) => {
    setChartTrade(trade)
    setChartStyle('candle')
    setChartLoading(true)
    try {
      const candles = await getStockCandles(trade.symbol, 'D', 'ma44', 90)
      setChartBars(candles.bars)
    } catch {
      setChartBars([])
    } finally {
      setChartLoading(false)
    }
  }

  const summary = data?.summary
  const items = data?.items ?? []
  const canAdd = Boolean(form.symbol.trim() && Number(form.qty) > 0 && Number(form.buy) > 0)

  const tradeMarkers: ChartMarker[] = []
  const priceLevels: PriceLevel[] = []
  if (chartTrade) {
    tradeMarkers.push({
      date: chartTrade.entry_date,
      kind: 'entry',
      label: 'ENTRY',
      color: '#3C2CDA',
    })
    const exitDate = chartTrade.exit_date || chartBars[chartBars.length - 1]?.date || chartTrade.entry_date
    const win =
      (chartTrade.exit_price ?? chartTrade.last_close ?? chartTrade.entry_price) >= chartTrade.entry_price
    tradeMarkers.push({
      date: exitDate,
      kind: 'exit',
      label: chartTrade.is_open ? 'NOW' : 'EXIT',
      color: win ? '#12A053' : '#DC3545',
    })
    priceLevels.push({ price: chartTrade.entry_price, color: '#3C2CDA' })
    priceLevels.push({
      price: chartTrade.exit_price ?? chartTrade.last_close ?? chartTrade.entry_price,
      color: win ? '#12A053' : '#DC3545',
    })
  }

  return (
    <section className='screen journal-screen'>
      <div className='journal-header'>
        <h1 className='screen-title'>Trading Journal</h1>
        <p className='journal-subtitle'>
          Log trades with full Zerodha charges — brokerage, STT, exchange, SEBI, stamp duty, GST, and DP — to see true
          net P&amp;L.
        </p>
      </div>

      <div className='journal-kpis'>
        <div className='journal-kpi'>
          <span>Trades</span>
          <strong>{summary?.trade_count ?? 0}</strong>
        </div>
        <div className='journal-kpi'>
          <span>Realized P&amp;L</span>
          <strong className={pnlClass(summary?.realized_net)}>{money(summary?.realized_net ?? 0)}</strong>
        </div>
        <div className='journal-kpi'>
          <span>Unrealized · {summary?.open_count ?? 0} open</span>
          <strong className={pnlClass(summary?.unrealized)}>{money(summary?.unrealized ?? 0)}</strong>
        </div>
        <div className='journal-kpi'>
          <span>Total Charges</span>
          <strong className='charges'>{money(summary?.total_charges ?? 0)}</strong>
        </div>
        <div className='journal-kpi'>
          <span>Win Rate</span>
          <strong>{summary?.win_rate == null ? '—' : `${summary.win_rate.toFixed(0)}%`}</strong>
        </div>
      </div>

      <div className='journal-layout'>
        <div className='journal-main'>
          <div className='journal-card'>
            <div className='journal-card-head'>
              <strong>Analytics</strong>
              <span>{analytics?.closed_count ?? 0} closed trades</span>
            </div>
            {analytics && analytics.closed_count > 0 ? (
              <>
                <div className='journal-equity-wrap'>
                  <canvas ref={equityRef} className='journal-equity' />
                </div>
                <div className='journal-analytics-grid'>
                  <div>
                    <span>Avg win</span>
                    <strong className='pos'>{money(analytics.avg_win)}</strong>
                  </div>
                  <div>
                    <span>Avg loss</span>
                    <strong className='neg'>{money(analytics.avg_loss)}</strong>
                  </div>
                  <div>
                    <span>Expectancy / trade</span>
                    <strong className={pnlClass(analytics.expectancy)}>{money(analytics.expectancy)}</strong>
                  </div>
                  <div>
                    <span>Largest win / loss</span>
                    <strong>
                      {money(analytics.largest_win)} <em>/</em> {money(analytics.largest_loss)}
                    </strong>
                  </div>
                </div>
                <div className='journal-breakdown'>
                  {analytics.by_segment.map((row) => (
                    <div key={row.segment}>
                      <span>{row.segment}</span>
                      <strong className={pnlClass(row.net)}>
                        {row.count} · {money(row.net)}
                      </strong>
                    </div>
                  ))}
                  {analytics.by_symbol.slice(0, 6).map((row) => (
                    <div key={row.symbol}>
                      <span>{row.symbol}</span>
                      <strong className={pnlClass(row.net)}>
                        {row.count} · {money(row.net)}
                      </strong>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className='journal-empty-inline'>Close a trade to unlock the equity curve and expectancy stats.</div>
            )}
          </div>

          {positions && positions.items.length ? (
            <div className='journal-card'>
              <div className='journal-card-head'>
                <strong>Open positions</strong>
                <span className={pnlClass(positions.total_unrealized)}>
                  {money(positions.total_unrealized)} unrealized
                </span>
              </div>
              <div className='journal-positions'>
                {positions.items.map((position) => (
                  <div key={position.id} className='journal-position'>
                    <div className='journal-position-main'>
                      <strong>{position.symbol}</strong>
                      <span>
                        {position.segment === 'Intraday' ? 'INT' : 'DEL'} · {position.qty} @ {position.entry_price.toFixed(2)}
                      </span>
                    </div>
                    <div className='journal-position-mark'>
                      <span>Mark {position.last_close == null ? '—' : position.last_close.toFixed(2)}</span>
                      <strong className={pnlClass(position.unrealized)}>{money(position.unrealized)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className='journal-card'>
            <div className='journal-toolbar'>
              <div className='journal-filter'>
                <input
                  value={filterQ}
                  onChange={(event) => setFilterQ(event.target.value)}
                  placeholder='Filter symbol/tag'
                />
                {(['All', 'Delivery', 'Intraday'] as const).map((seg) => (
                  <button
                    key={seg}
                    type='button'
                    className={filterSeg === seg ? 'active' : ''}
                    onClick={() => {
                      setFilterSeg(seg)
                      void reload(filterQ, seg, filterFrom, filterTo)
                    }}
                  >
                    {seg}
                  </button>
                ))}
                <input
                  type='date'
                  className='journal-date'
                  value={filterFrom}
                  max={filterTo || undefined}
                  onChange={(event) => setFilterFrom(event.target.value)}
                  title='From date'
                />
                <input
                  type='date'
                  className='journal-date'
                  value={filterTo}
                  min={filterFrom || undefined}
                  onChange={(event) => setFilterTo(event.target.value)}
                  title='To date'
                />
                {filterFrom || filterTo || filterQ || filterSeg !== 'All' ? (
                  <button
                    type='button'
                    onClick={() => {
                      setFilterQ('')
                      setFilterSeg('All')
                      setFilterFrom('')
                      setFilterTo('')
                      void reload('', 'All', '', '')
                    }}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <div className='journal-io'>
                <input
                  ref={importRef}
                  type='file'
                  accept='.csv,text/csv'
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null
                    event.target.value = ''
                    void onImport(file)
                  }}
                />
                <button type='button' onClick={() => importRef.current?.click()} disabled={busy}>
                  <Upload size={13} /> Import
                </button>
                <button type='button' onClick={() => void onExport()}>
                  <Download size={13} /> Export
                </button>
              </div>
            </div>

            {loading ? <div className='journal-empty-inline'>Loading trades…</div> : null}
            {error ? <div className='journal-empty-inline journal-error'>{error}</div> : null}
            {!loading && !items.length ? (
              <div className='journal-empty-inline'>
                {filterQ || filterSeg !== 'All' || filterFrom || filterTo
                  ? 'No trades match the current filter.'
                  : 'No trades yet. Add one on the right, or import a CSV.'}
              </div>
            ) : null}

            {items.length ? (
              <div className='journal-table-wrap'>
                <table className='journal-table'>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Symbol</th>
                      <th>Seg</th>
                      <th>Qty</th>
                      <th>Buy</th>
                      <th>Sell</th>
                      <th>Net</th>
                      <th>Tags</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((trade) => {
                      const net = trade.is_open ? trade.unrealized : trade.charges.net
                      return (
                        <tr key={trade.id}>
                          <td>
                            <button type='button' className='journal-link' onClick={() => void openChart(trade)}>
                              {trade.entry_date}
                              {trade.exit_date ? ` → ${trade.exit_date}` : ' · open'}
                            </button>
                          </td>
                          <td>
                            <button type='button' className='journal-link strong' onClick={() => void openChart(trade)}>
                              {trade.symbol}
                            </button>
                            {trade.is_open ? <span className='journal-open-badge'>OPEN</span> : null}
                          </td>
                          <td>{trade.segment === 'Intraday' ? 'INT' : 'DEL'}</td>
                          <td>{trade.qty}</td>
                          <td>{trade.entry_price.toFixed(2)}</td>
                          <td>{trade.exit_price == null ? '—' : trade.exit_price.toFixed(2)}</td>
                          <td className={pnlClass(net)}>{money(net)}</td>
                          <td>
                            <div className='journal-tags'>
                              {trade.tags.map((tag) => (
                                <span key={tag}>{tag}</span>
                              ))}
                            </div>
                            {editId === trade.id ? (
                              <div className='journal-note-edit'>
                                <textarea value={editNotes} onChange={(event) => setEditNotes(event.target.value)} />
                                <div>
                                  <button type='button' onClick={() => setEditId(null)}>
                                    Cancel
                                  </button>
                                  <button type='button' className='primary' onClick={() => void onSaveNotes(trade.id)}>
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type='button'
                                className='journal-note-btn'
                                onClick={() => {
                                  setEditId(trade.id)
                                  setEditNotes(trade.notes)
                                }}
                              >
                                {trade.notes || 'Add note…'}
                              </button>
                            )}
                          </td>
                          <td>
                            <button type='button' className='journal-icon-btn' onClick={() => void onDelete(trade.id)} title='Delete'>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>

        <aside className='journal-side'>
          <div className='journal-card'>
            <strong className='journal-form-title'>Add trade</strong>
            <label>
              Symbol
              <input
                value={form.symbol}
                onChange={(event) => setForm((prev) => ({ ...prev, symbol: event.target.value.toUpperCase() }))}
                placeholder='e.g. RELIANCE'
              />
            </label>
            <div className='journal-row'>
              <label>
                Entry date
                <input
                  type='date'
                  value={form.entryDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, entryDate: event.target.value }))}
                />
              </label>
              <label>
                Exit date
                <input
                  type='date'
                  value={form.exitDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, exitDate: event.target.value }))}
                />
              </label>
            </div>
            <div className='journal-seg'>
              <button
                type='button'
                className={form.segment === 'Delivery' ? 'active' : ''}
                onClick={() => setForm((prev) => ({ ...prev, segment: 'Delivery' }))}
              >
                Delivery
              </button>
              <button
                type='button'
                className={form.segment === 'Intraday' ? 'active' : ''}
                onClick={() => setForm((prev) => ({ ...prev, segment: 'Intraday' }))}
              >
                Intraday
              </button>
            </div>
            <label>
              Quantity
              <input
                type='number'
                value={form.qty}
                onChange={(event) => setForm((prev) => ({ ...prev, qty: event.target.value }))}
                placeholder='0'
              />
            </label>
            <div className='journal-row'>
              <label>
                Buy price
                <input
                  type='number'
                  value={form.buy}
                  onChange={(event) => setForm((prev) => ({ ...prev, buy: event.target.value }))}
                  placeholder='0.00'
                />
              </label>
              <label>
                Sell price <em>(blank = open)</em>
                <input
                  type='number'
                  value={form.sell}
                  onChange={(event) => setForm((prev) => ({ ...prev, sell: event.target.value }))}
                  placeholder='0.00'
                />
              </label>
            </div>
            <label>
              Tags <em>(comma-separated)</em>
              <input
                value={form.tags}
                onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
                placeholder='breakout, swing…'
              />
            </label>
            <label>
              Comment <em>(optional)</em>
              <textarea
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder='Setup, rationale, mistakes, lessons…'
              />
            </label>

            {preview ? (
              <div className='journal-preview'>
                <div>
                  <span>Gross P&amp;L</span>
                  <strong>{money(preview.gross)}</strong>
                </div>
                <div>
                  <span>Brokerage</span>
                  <strong>{money(preview.brokerage)}</strong>
                </div>
                <div>
                  <span>STT</span>
                  <strong>{money(preview.stt)}</strong>
                </div>
                <div>
                  <span>Exchange txn</span>
                  <strong>{money(preview.txn)}</strong>
                </div>
                <div>
                  <span>SEBI</span>
                  <strong>{money(preview.sebi)}</strong>
                </div>
                <div>
                  <span>Stamp duty</span>
                  <strong>{money(preview.stamp)}</strong>
                </div>
                <div>
                  <span>GST</span>
                  <strong>{money(preview.gst)}</strong>
                </div>
                {form.segment === 'Delivery' ? (
                  <div>
                    <span>DP charges</span>
                    <strong>{money(preview.dp)}</strong>
                  </div>
                ) : null}
                <div className='total'>
                  <span>Total charges</span>
                  <strong>{money(preview.total)}</strong>
                </div>
                <div>
                  <span>Net P&amp;L</span>
                  <strong className={pnlClass(preview.net)}>{money(preview.net)}</strong>
                </div>
              </div>
            ) : form.sell.trim() === '' && Number(form.qty) > 0 && Number(form.buy) > 0 ? (
              <div className='journal-preview open'>Open position — charges apply on exit. Unrealized uses latest close.</div>
            ) : null}

            <button type='button' className='journal-add' disabled={!canAdd || busy} onClick={() => void onAdd()}>
              Add trade
            </button>
            <p className='journal-footnote'>
              Charges follow Zerodha’s equity schedule: Delivery — ₹0 brokerage, STT 0.1% both sides, stamp 0.015% (buy),
              DP ₹15.34/scrip on sell. Intraday — 0.03% or ₹20/order brokerage, STT 0.025% (sell), stamp 0.003% (buy). Plus
              NSE txn 0.00297%, SEBI ₹10/cr, and 18% GST.
            </p>
          </div>
        </aside>
      </div>

      {chartTrade ? (
        <div className='journal-modal-backdrop' onClick={() => setChartTrade(null)}>
          <div className='journal-modal' onClick={(event) => event.stopPropagation()}>
            <div className='journal-modal-head'>
              <div>
                <h2>
                  {chartTrade.symbol} · {chartTrade.segment}
                </h2>
                <p>
                  Entry {chartTrade.entry_price.toFixed(2)} on {chartTrade.entry_date}
                  {chartTrade.exit_price != null
                    ? ` · Exit ${chartTrade.exit_price.toFixed(2)} on ${chartTrade.exit_date}`
                    : ' · Open'}
                </p>
              </div>
              <div className='journal-modal-actions'>
                <button
                  type='button'
                  className={chartStyle === 'candle' ? 'active' : ''}
                  onClick={() => setChartStyle('candle')}
                >
                  Candles
                </button>
                <button
                  type='button'
                  className={chartStyle === 'line' ? 'active' : ''}
                  onClick={() => setChartStyle('line')}
                >
                  Line
                </button>
                <button type='button' className='journal-close' onClick={() => setChartTrade(null)}>
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className='journal-modal-chart'>
              {chartLoading ? <div className='journal-empty-inline'>Loading chart…</div> : null}
              {!chartLoading && chartBars.length ? (
                <PriceChart
                  bars={chartBars}
                  markers={tradeMarkers}
                  priceLevels={priceLevels}
                  chartStyle={chartStyle}
                  showBollinger={false}
                  showRsi={false}
                  timeframe='D'
                />
              ) : null}
              {!chartLoading && !chartBars.length ? (
                <div className='journal-empty-inline'>No price bars for {chartTrade.symbol}. Sync the symbol first.</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <div className='list-toast'>{toast}</div> : null}
    </section>
  )
}
