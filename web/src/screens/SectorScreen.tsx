import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, TrendingDown, TrendingUp } from 'lucide-react'
import {
  compareSectors,
  getSectorDetail,
  getSectors,
  type SectorCompareSeries,
  type SectorConstituent,
  type SectorDetail,
  type SectorSummary,
} from '../api/sectors'
import { SectorAIPanel } from '../components/SectorAIPanel'

type SortKey = 'symbol' | 'close' | 'ma44' | 'pct'
type SortDir = 'asc' | 'desc'

function Sparkline({ values }: { values: number[] }) {
  if (!values.length) {
    return <span className='sec-spark-empty'>—</span>
  }
  const width = 72
  const height = 22
  const min = Math.min(...values)
  const max = Math.max(...values)
  const spread = max - min || 1
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width
      const y = height - ((value - min) / spread) * (height - 2) - 1
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const up = values[values.length - 1] >= values[0]
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={`sec-spark ${up ? 'up' : 'down'}`} aria-hidden>
      <polyline fill='none' stroke='currentColor' strokeWidth='1.5' points={points} />
    </svg>
  )
}

function RotationChart({
  sectors,
  selected,
  onSelect,
}: {
  sectors: SectorSummary[]
  selected: string | null
  onSelect: (name: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const hitRef = useRef<Array<{ name: string; x: number; y: number; r: number }>>([])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) {
      return
    }

    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const width = wrap.clientWidth
      const height = wrap.clientHeight
      if (!width || !height) {
        return
      }
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      const pad = 28
      const plotW = width - pad * 2
      const plotH = height - pad * 2
      const xs = sectors.map((item) => item.rotation_x)
      const ys = sectors.map((item) => item.rotation_y)
      const minX = Math.min(0, ...xs) - 5
      const maxX = Math.max(100, ...xs) + 5
      const minY = Math.min(-20, ...ys) - 5
      const maxY = Math.max(20, ...ys) + 5
      const sx = (value: number) => pad + ((value - minX) / (maxX - minX || 1)) * plotW
      const sy = (value: number) => pad + (1 - (value - minY) / (maxY - minY || 1)) * plotH

      const cx = sx(50)
      const cy0 = sy(0)
      // Quadrant shading: breadth (x, split at 50%) vs momentum (y, split at 0).
      ctx.fillStyle = 'rgba(18,160,83,0.06)' // Leading (top-right)
      ctx.fillRect(cx, pad, pad + plotW - cx, cy0 - pad)
      ctx.fillStyle = 'rgba(29,134,255,0.06)' // Improving (top-left)
      ctx.fillRect(pad, pad, cx - pad, cy0 - pad)
      ctx.fillStyle = 'rgba(234,157,0,0.06)' // Weakening (bottom-right)
      ctx.fillRect(cx, cy0, pad + plotW - cx, pad + plotH - cy0)
      ctx.fillStyle = 'rgba(220,53,69,0.06)' // Lagging (bottom-left)
      ctx.fillRect(pad, cy0, cx - pad, pad + plotH - cy0)

      ctx.font = '9px Manrope, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillStyle = '#12A053'
      ctx.fillText('Leading', cx + 6, pad + 12)
      ctx.fillStyle = '#1D86FF'
      ctx.fillText('Improving', pad + 4, pad + 12)
      ctx.fillStyle = '#EA9D00'
      ctx.fillText('Weakening', cx + 6, pad + plotH - 6)
      ctx.fillStyle = '#DC3545'
      ctx.fillText('Lagging', pad + 4, pad + plotH - 6)

      ctx.strokeStyle = '#D7DBE0'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(pad, cy0)
      ctx.lineTo(pad + plotW, cy0)
      ctx.moveTo(cx, pad)
      ctx.lineTo(cx, pad + plotH)
      ctx.stroke()

      ctx.fillStyle = '#9BA3AD'
      ctx.font = '10px Manrope, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('Breadth →', pad + plotW - 54, height - 8)
      ctx.save()
      ctx.translate(10, pad + 40)
      ctx.rotate(-Math.PI / 2)
      ctx.fillText('Momentum', 0, 0)
      ctx.restore()

      hitRef.current = []
      sectors.forEach((sector) => {
        const x = sx(sector.rotation_x)
        const y = sy(sector.rotation_y)
        const active = sector.name === selected
        const up = sector.rotation_y >= 0
        const r = active ? 8 : 6
        ctx.beginPath()
        ctx.fillStyle = up ? 'rgba(18,160,83,0.75)' : 'rgba(220,53,69,0.7)'
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
        if (active) {
          ctx.strokeStyle = '#111827'
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
        ctx.fillStyle = '#374151'
        ctx.font = `${active ? '700 ' : ''}10px Manrope, sans-serif`
        ctx.fillText(sector.name.slice(0, 14), x + 10, y + 3)
        hitRef.current.push({ name: sector.name, x, y, r: r + 6 })
      })
    }

    draw()
    const observer = new ResizeObserver(() => draw())
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [sectors, selected])

  return (
    <div
      ref={wrapRef}
      className='sec-canvas-wrap rotation'
      onClick={(event) => {
        const rect = wrapRef.current?.getBoundingClientRect()
        if (!rect) {
          return
        }
        const x = event.clientX - rect.left
        const y = event.clientY - rect.top
        const hit = hitRef.current.find((item) => Math.hypot(item.x - x, item.y - y) <= item.r)
        if (hit) {
          onSelect(hit.name)
        }
      }}
    >
      <canvas ref={canvasRef} />
    </div>
  )
}

function CompareChart({ series }: { series: SectorCompareSeries[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap || !series.length) {
      return
    }

    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const width = wrap.clientWidth
      const height = wrap.clientHeight
      if (!width || !height) {
        return
      }
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      const padL = 28
      const padR = 10
      const padT = 10
      const padB = 22
      const plotW = width - padL - padR
      const plotH = height - padT - padB
      const n = Math.max(...series.map((item) => item.points.length), 1)
      const all = series.flatMap((item) => item.points.map((point) => point.pct))
      const min = Math.min(0, ...all) - 5
      const max = Math.max(100, ...all) + 5
      const sx = (index: number) => padL + (index / Math.max(n - 1, 1)) * plotW
      const sy = (value: number) => padT + (1 - (value - min) / (max - min || 1)) * plotH

      ctx.strokeStyle = '#EEF0F3'
      ctx.beginPath()
      for (let i = 0; i <= 4; i += 1) {
        const y = padT + (plotH * i) / 4
        ctx.moveTo(padL, y)
        ctx.lineTo(padL + plotW, y)
      }
      ctx.stroke()

      series.forEach((item) => {
        ctx.beginPath()
        item.points.forEach((point, index) => {
          const x = sx(index)
          const y = sy(point.pct)
          if (index === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.strokeStyle = item.color
        ctx.lineWidth = item.selected ? 2.4 : 1.2
        ctx.globalAlpha = item.selected ? 1 : 0.35
        ctx.stroke()
        ctx.globalAlpha = 1
      })

      const labels = series[0]?.points.map((point) => point.label) ?? []
      ctx.fillStyle = '#9BA3AD'
      ctx.font = '9px Manrope, sans-serif'
      ctx.textAlign = 'center'
      labels.forEach((label, index) => {
        if (index % 2 === 0 || index === labels.length - 1) {
          ctx.fillText(label, sx(index), height - 6)
        }
      })
    }

    draw()
    const observer = new ResizeObserver(() => draw())
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [series])

  return (
    <div ref={wrapRef} className='sec-canvas-wrap compare'>
      <canvas ref={canvasRef} />
    </div>
  )
}

export function SectorScreen() {
  const navigate = useNavigate()
  const [summaries, setSummaries] = useState<SectorSummary[]>([])
  const [detail, setDetail] = useState<SectorDetail | null>(null)
  const [compare, setCompare] = useState<SectorCompareSeries[]>([])
  const [selected, setSelected] = useState<string | null>(localStorage.getItem('sec:selected'))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('pct')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true)
        setError('')
        try {
          const payload = await getSectors()
          setSummaries(payload.sectors)
          setSelected((current) => {
            if (current && payload.sectors.some((item) => item.name === current)) {
              return current
            }
            return payload.sectors[0]?.name ?? null
          })
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load sectors.')
        } finally {
          setLoading(false)
        }
      })()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!selected) {
      return
    }
    localStorage.setItem('sec:selected', selected)
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const [detailPayload, comparePayload] = await Promise.all([
            getSectorDetail(selected),
            compareSectors(selected),
          ])
          setDetail(detailPayload)
          setCompare(
            comparePayload.sectors.map((item) => ({ ...item, selected: item.name === selected })),
          )
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load sector detail.')
        }
      })()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [selected])

  const sortedRows = useMemo(() => {
    if (!detail) {
      return [] as SectorConstituent[]
    }
    const rows = detail.constituents.slice()
    const dir = sortDir === 'asc' ? 1 : -1
    rows.sort((a, b) => {
      const left = sortKey === 'symbol' ? a.symbol : sortKey === 'close' ? a.close : sortKey === 'ma44' ? a.ma44 ?? 0 : a.pct_vs_ma44
      const right = sortKey === 'symbol' ? b.symbol : sortKey === 'close' ? b.close : sortKey === 'ma44' ? b.ma44 ?? 0 : b.pct_vs_ma44
      if (typeof left === 'string' && typeof right === 'string') {
        return left.localeCompare(right) * dir
      }
      return (Number(left) - Number(right)) * dir
    })
    return rows
  }, [detail, sortDir, sortKey])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'symbol' ? 'asc' : 'desc')
    }
  }

  const arrow = (key: SortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '')

  const openInWorkspace = (symbol: string) => {
    localStorage.setItem('ws:selected', symbol)
    navigate('/workspace?filter=all')
  }

  return (
    <section className='screen sec-screen'>
      <div className='sec-header'>
        <div>
          <h1 className='screen-title'>Sector analysis</h1>
          <p className='sec-subtitle'>Breadth, momentum, and constituents for a single sector of the active universe.</p>
        </div>
      </div>

      {loading ? <div className='sec-empty'>Loading sectors...</div> : null}
      {error ? <div className='sec-empty sec-error'>{error}</div> : null}
      {!loading && !error && summaries.length === 0 ? (
        <div className='sec-empty'>No stock universe yet. Upload a list in Admin first.</div>
      ) : null}

      {!loading && summaries.length > 0 ? (
        <>
          <div className='sec-tabs'>
            {summaries.map((sector) => (
              <button
                key={sector.name}
                type='button'
                className={sector.name === selected ? 'active' : ''}
                onClick={() => setSelected(sector.name)}
              >
                {sector.name}
              </button>
            ))}
          </div>

          {detail && detail.name === selected ? (
            <>
              <div className='sec-metrics'>
                <div className='sec-metric'>
                  <span>Constituents</span>
                  <strong>{detail.total}</strong>
                </div>
                <div className='sec-metric'>
                  <span>Breadth</span>
                  <strong className='up'>{detail.breadth.toFixed(0)}%</strong>
                  <em>
                    {detail.above} of {detail.total} above
                  </em>
                </div>
                <div className='sec-metric'>
                  <span>Avg % vs 44 MA</span>
                  <strong className={detail.avg_pct_vs_ma >= 0 ? 'up' : 'down'}>
                    {detail.avg_pct_vs_ma >= 0 ? '+' : ''}
                    {detail.avg_pct_vs_ma.toFixed(2)}%
                  </strong>
                </div>
                <div className='sec-metric'>
                  <span>Adv / Dec</span>
                  <strong>
                    {detail.advancers} <span className='up'>▲</span> / {detail.decliners} <span className='down'>▼</span>
                  </strong>
                </div>
                <div className='sec-metric'>
                  <span>8-week avg</span>
                  <strong>{detail.avg8.toFixed(0)}%</strong>
                  <em className={detail.momentum >= 0 ? 'up' : 'down'}>
                    {detail.momentum >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                    {detail.momentum >= 0 ? '+' : ''}
                    {detail.momentum.toFixed(1)} pts momentum
                  </em>
                </div>
              </div>

              <div className='sec-main-grid'>
                <div className='sec-card'>
                  <div className='sec-card-title'>Constituents · {detail.name}</div>
                  <div className='sec-table-head'>
                    <button type='button' onClick={() => toggleSort('symbol')}>
                      Symbol{arrow('symbol')}
                    </button>
                    <span>Trend</span>
                    <button type='button' onClick={() => toggleSort('close')}>
                      Close{arrow('close')}
                    </button>
                    <button type='button' onClick={() => toggleSort('ma44')}>
                      44 MA{arrow('ma44')}
                    </button>
                    <button type='button' onClick={() => toggleSort('pct')}>
                      % vs MA{arrow('pct')}
                    </button>
                  </div>
                  <div className='sec-table-body'>
                    {sortedRows.map((row) => (
                      <div
                        key={row.symbol}
                        className='sec-table-row clickable'
                        role='button'
                        tabIndex={0}
                        title={`Open ${row.symbol} in workspace`}
                        onClick={() => openInWorkspace(row.symbol)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            openInWorkspace(row.symbol)
                          }
                        }}
                      >
                        <div>
                          <strong>{row.symbol}</strong>
                          <span>{row.company}</span>
                        </div>
                        <Sparkline values={row.sparkline} />
                        <div className='num'>{row.close.toFixed(1)}</div>
                        <div className='num'>{row.ma44?.toFixed(1) ?? '—'}</div>
                        <div className={`num ${row.pct_vs_ma44 >= 0 ? 'up' : 'down'}`}>
                          <span className={`sec-ab-badge ${row.above_ma44 ? 'above' : 'below'}`}>
                            {row.above_ma44 ? 'Above' : 'Below'}
                          </span>
                          {row.pct_vs_ma44 >= 0 ? '+' : ''}
                          {row.pct_vs_ma44.toFixed(2)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className='sec-side'>
                  <div className='sec-card'>
                    <div className='sec-card-title'>Leaders & laggards</div>
                    <div className='sec-leader-row'>
                      <span>
                        <TrendingUp size={16} /> {detail.leader?.symbol ?? '—'}
                      </span>
                      <strong className='up'>
                        {detail.leader ? `${detail.leader.pct_vs_ma44 >= 0 ? '+' : ''}${detail.leader.pct_vs_ma44.toFixed(2)}%` : '—'}
                      </strong>
                    </div>
                    <div className='sec-leader-row'>
                      <span>
                        <TrendingDown size={16} /> {detail.laggard?.symbol ?? '—'}
                      </span>
                      <strong className='down'>
                        {detail.laggard ? `${detail.laggard.pct_vs_ma44 >= 0 ? '+' : ''}${detail.laggard.pct_vs_ma44.toFixed(2)}%` : '—'}
                      </strong>
                    </div>
                  </div>

                  <div className='sec-card'>
                    <div className='sec-card-title'>Weekly breadth · % above 44 MA</div>
                    <div className='sec-trend-bars'>
                      {detail.weekly_trend.map((point) => (
                        <div key={point.label} className='sec-trend-col'>
                          <div className='sec-trend-bar' style={{ height: `${Math.max(8, point.pct)}%` }} title={`${point.pct}%`} />
                          <span>{point.label}</span>
                        </div>
                      ))}
                    </div>
                    <div className='sec-split'>
                      <div className='sec-split-bar'>
                        <div style={{ width: `${detail.breadth}%` }} className='above' />
                        <div style={{ width: `${100 - detail.breadth}%` }} className='below' />
                      </div>
                      <div className='sec-split-legend'>
                        <span className='up'>{detail.above} above</span>
                        <span className='down'>{detail.below} below</span>
                      </div>
                    </div>
                  </div>

                  <div className='sec-card'>
                    <div className='sec-card-title'>Sector rotation</div>
                    <p className='sec-help'>8-week avg breadth (x) vs latest momentum (y). Click a sector to select it.</p>
                    <RotationChart sectors={summaries} selected={selected} onSelect={setSelected} />
                  </div>

                  <div className='sec-card'>
                    <div className='sec-card-title'>Compare</div>
                    <p className='sec-help'>Weekly % above 44 MA, all sectors. Selected sector bold.</p>
                    <CompareChart series={compare} />
                    <div className='sec-legend'>
                      {compare.map((item) => (
                        <button
                          key={item.name}
                          type='button'
                          className={item.name === selected ? 'active' : ''}
                          onClick={() => setSelected(item.name)}
                        >
                          <i style={{ background: item.color }} />
                          {item.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <SectorAIPanel sector={detail.name} symbols={detail.constituents.map((item) => item.symbol)} />
            </>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
