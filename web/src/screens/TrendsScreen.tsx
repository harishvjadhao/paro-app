import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import {
  getWeeklyTrendDrill,
  getWeeklyTrends,
  type TrendDrillResponse,
  type WeeklyTrendsResponse,
} from '../api/trends'

function cellStyle(pct: number): string {
  if (pct >= 60) {
    const alpha = Math.min(0.62, 0.14 + ((pct - 60) / 40) * 0.55)
    return `rgba(18,160,83,${alpha.toFixed(2)})`
  }
  if (pct <= 40) {
    const alpha = Math.min(0.62, 0.14 + ((40 - pct) / 40) * 0.55)
    return `rgba(220,53,69,${alpha.toFixed(2)})`
  }
  return 'var(--gray-100, #f3f4f6)'
}

function cellColor(pct: number): string {
  if (pct >= 60) return '#0b6b38'
  if (pct <= 40) return '#a51f2b'
  return 'var(--text-soft)'
}

export function TrendsScreen() {
  const navigate = useNavigate()
  const [data, setData] = useState<WeeklyTrendsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [drill, setDrill] = useState<TrendDrillResponse | null>(null)
  const [drillBusy, setDrillBusy] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true)
        setError('')
        try {
          const payload = await getWeeklyTrends()
          setData(payload)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load weekly trends.')
        } finally {
          setLoading(false)
        }
      })()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const openDrill = async (sector: string, weekIndex: number) => {
    setDrillBusy(true)
    try {
      const payload = await getWeeklyTrendDrill(sector, weekIndex)
      setDrill(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load drill-down.')
    } finally {
      setDrillBusy(false)
    }
  }

  const openInWorkspace = (symbol: string) => {
    localStorage.setItem('ws:selected', symbol)
    setDrill(null)
    navigate('/workspace?filter=all')
  }

  const gridTemplate = data
    ? `minmax(160px, 1.2fr) repeat(${data.weeks.length}, minmax(72px, 1fr)) minmax(64px, 0.7fr)`
    : undefined

  return (
    <section className='screen trends-screen'>
      <div className='trends-header'>
        <h1 className='screen-title'>Weekly Sector Trends</h1>
        <p className='trends-subtitle'>
          Share of stocks trading above their 44-day MA each day, averaged per week, over the last 8 weeks.
          {data ? ` ${data.summary}` : ''}
        </p>
      </div>

      {loading ? <div className='trends-empty'>Loading weekly trends...</div> : null}
      {error ? <div className='trends-empty trends-error'>{error}</div> : null}
      {!loading && !error && data && data.sectors.length === 0 ? (
        <div className='trends-empty'>No stock universe yet. Upload a list in Admin first.</div>
      ) : null}

      {!loading && data && data.sectors.length > 0 ? (
        <div className='trends-card'>
          <div className='trends-card-head'>
            <strong>% above 44-day MA by sector</strong>
            <div className='trends-legend'>
              <span>
                <i className='above' /> Mostly above
              </span>
              <span>
                <i className='mixed' /> Mixed
              </span>
              <span>
                <i className='below' /> Mostly below
              </span>
            </div>
          </div>

          <div className='trends-scroll'>
            <div className='trends-matrix' style={{ minWidth: `${180 + data.weeks.length * 80 + 70}px` }}>
              <div className='trends-grid' style={{ gridTemplateColumns: gridTemplate }}>
                <div className='trends-corner'>Sector · week ending</div>
                {data.weeks.map((week) => (
                  <div key={week.index} className='trends-week'>
                    {week.label}
                  </div>
                ))}
                <div className='trends-week'>Avg</div>
              </div>

              {data.sectors.map((row) => (
                <div key={row.name} className='trends-grid' style={{ gridTemplateColumns: gridTemplate }}>
                  <div className='trends-sector'>
                    <strong>{row.name}</strong>
                    <span>{row.total} stocks</span>
                  </div>
                  {row.cells.map((cell) => (
                    <button
                      key={`${row.name}-${cell.week_index}`}
                      type='button'
                      className='trends-cell'
                      style={{ background: cellStyle(cell.pct), color: cellColor(cell.pct) }}
                      disabled={drillBusy}
                      onClick={() => void openDrill(row.name, cell.week_index)}
                      title={`${row.name} · week ending ${data.weeks[cell.week_index]?.label ?? ''}`}
                    >
                      <strong>{Math.round(cell.pct)}%</strong>
                      <span>
                        {Math.round(cell.avg_above)}/{cell.total}
                      </span>
                    </button>
                  ))}
                  <div className='trends-cell avg' style={{ background: cellStyle(row.avg), color: cellColor(row.avg) }}>
                    <strong>{Math.round(row.avg)}%</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className='trends-footnote'>
            Each cell = average share of the sector’s stocks trading above their 44-day MA across that week’s trading
            days; the sub-figure is the average number of stocks above out of the sector total. Sectors ranked by
            8-week average breadth. Click a cell to drill into constituents.
          </p>
        </div>
      ) : null}

      {drill ? (
        <div className='trends-drill-backdrop' onClick={() => setDrill(null)}>
          <div className='trends-drill' onClick={(event) => event.stopPropagation()}>
            <div className='trends-drill-head'>
              <div>
                <h2>
                  {drill.sector} · week of {drill.week_label}
                </h2>
                <p>
                  {drill.above_count} of {drill.total} stocks above 44 MA ({Math.round(drill.pct)}%)
                </p>
              </div>
              <button type='button' className='trends-close' onClick={() => setDrill(null)} title='Close'>
                <X size={16} />
              </button>
            </div>
            <div className='trends-drill-list'>
              {drill.stocks.map((stock) => (
                <div
                  key={stock.symbol}
                  className='trends-drill-row clickable'
                  role='button'
                  tabIndex={0}
                  title={`Open ${stock.symbol} in workspace`}
                  onClick={() => openInWorkspace(stock.symbol)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openInWorkspace(stock.symbol)
                    }
                  }}
                >
                  <strong>{stock.symbol}</strong>
                  <span>{stock.company}</span>
                  <em className={stock.pct_vs_ma44 >= 0 ? 'up' : 'down'}>
                    {stock.pct_vs_ma44 >= 0 ? '+' : ''}
                    {stock.pct_vs_ma44.toFixed(2)}%
                  </em>
                  <i className={stock.above_ma44 ? 'above' : 'below'}>
                    {stock.above_ma44 ? 'Above' : 'Below'}
                    {stock.flipped ? ' · flipped' : ''}
                  </i>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
