import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { CandleItem, ChartMarker, PriceLevel } from '../api/workspace'

type PriceChartProps = {
  bars: CandleItem[]
  markers?: ChartMarker[]
  priceLevels?: PriceLevel[]
  chartStyle?: 'candle' | 'line'
  showBollinger: boolean
  showRsi: boolean
  timeframe: 'D' | 'W' | 'M'
}

function readCssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

export function PriceChart({
  bars,
  markers = [],
  priceLevels = [],
  chartStyle = 'candle',
  showBollinger,
  showRsi,
  timeframe,
}: PriceChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [hoverY, setHoverY] = useState<number | null>(null)

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
      if (!width || !height || !bars.length) {
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

      const padL = 10
      const padR = 58
      const padT = 12
      const padB = 22
      const gap = 8
      const plotW = width - padL - padR
      const avail = height - padT - padB
      const volH = Math.max(showRsi ? 26 : 34, avail * (showRsi ? 0.12 : 0.18))
      const rsiH = showRsi ? Math.max(56, avail * 0.3) : 0
      const priceH = avail - volH - rsiH - gap * (showRsi ? 2 : 1)
      const priceTop = padT
      const volTop = priceTop + priceH + gap
      const bandBottom = volTop + volH
      const rsiTop = bandBottom + gap
      const rsiBottom = rsiTop + rsiH
      const n = bars.length
      const cw = plotW / Math.max(n, 1)
      const bw = Math.max(2, cw * 0.6)

      let hi = -Infinity
      let lo = Infinity
      for (const bar of bars) {
        hi = Math.max(hi, bar.h)
        lo = Math.min(lo, bar.l)
        if (bar.ma44 !== null) {
          hi = Math.max(hi, bar.ma44)
          lo = Math.min(lo, bar.ma44)
        }
        if (showBollinger) {
          if (bar.bb_upper !== null) hi = Math.max(hi, bar.bb_upper)
          if (bar.bb_lower !== null) lo = Math.min(lo, bar.bb_lower)
        }
      }
      for (const level of priceLevels) {
        hi = Math.max(hi, level.price)
        lo = Math.min(lo, level.price)
      }
      const pad = (hi - lo) * 0.08 || 1
      hi += pad
      lo -= pad

      const py = (value: number) => priceTop + (1 - (value - lo) / (hi - lo || 1)) * priceH
      const cx = (index: number) => padL + cw * index + cw / 2
      const fontFamily = getComputedStyle(document.body).fontFamily || 'Manrope, sans-serif'
      const axis = readCssVar('--text-soft', '#9BA3AD')
      const grid = readCssVar('--border', '#EEF0F3')

      if (timeframe === 'D') {
        const highlightMap = new Map(
          markers.filter((marker) => marker.kind === 'highlight').map((marker) => [marker.date, marker]),
        )
        bars.forEach((bar, index) => {
          const highlight = highlightMap.get(bar.date)
          if (!highlight) {
            return
          }
          const color = highlight.color || '#3C2CDA'
          ctx.fillStyle = `${color}20`
          ctx.fillRect(cx(index) - cw / 2, priceTop, cw, bandBottom - priceTop)
          ctx.fillStyle = color
          ctx.fillRect(cx(index) - cw * 0.35, priceTop, cw * 0.7, 3)
        })
      }

      ctx.font = `10px ${fontFamily}`
      for (let i = 0; i <= 4; i += 1) {
        const value = lo + ((hi - lo) * i) / 4
        const y = py(value)
        ctx.strokeStyle = grid
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(padL, y)
        ctx.lineTo(padL + plotW, y)
        ctx.stroke()
        ctx.fillStyle = axis
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(value.toFixed(0), padL + plotW + 6, y)
      }

      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = axis
      for (let i = 0; i <= 6; i += 1) {
        const idx = Math.round(((n - 1) * i) / 6)
        if (!bars[idx]) {
          continue
        }
        const label = bars[idx].date.slice(5)
        ctx.fillText(label, cx(idx), height - padB + 5)
      }

      if (chartStyle === 'line') {
        ctx.beginPath()
        bars.forEach((bar, index) => {
          const x = cx(index)
          const y = py(bar.c)
          if (index === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        })
        ctx.strokeStyle = '#1D86FF'
        ctx.lineWidth = 2
        ctx.lineJoin = 'round'
        ctx.stroke()
        ctx.lineTo(cx(n - 1), priceTop + priceH)
        ctx.lineTo(cx(0), priceTop + priceH)
        ctx.closePath()
        ctx.fillStyle = 'rgba(29,134,255,0.08)'
        ctx.fill()
      } else {
        bars.forEach((bar, index) => {
          const up = bar.c >= bar.o
          const color = up ? '#12A053' : '#DC3545'
          const x = cx(index)
          ctx.strokeStyle = color
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(x, py(bar.h))
          ctx.lineTo(x, py(bar.l))
          ctx.stroke()
          const yOpen = py(bar.o)
          const yClose = py(bar.c)
          ctx.fillStyle = color
          ctx.fillRect(x - bw / 2, Math.min(yOpen, yClose), bw, Math.max(1, Math.abs(yClose - yOpen)))
          if (index === hoverIndex) {
            ctx.strokeStyle = '#111827'
            ctx.lineWidth = 1.5
            ctx.strokeRect(x - bw / 2 - 1.5, Math.min(yOpen, yClose) - 1.5, bw + 3, Math.max(1, Math.abs(yClose - yOpen)) + 3)
          }
        })
      }

      ctx.beginPath()
      let maStarted = false
      bars.forEach((bar, index) => {
        if (bar.ma44 === null) {
          return
        }
        const x = cx(index)
        const y = py(bar.ma44)
        if (!maStarted) {
          ctx.moveTo(x, y)
          maStarted = true
        } else {
          ctx.lineTo(x, y)
        }
      })
      ctx.strokeStyle = '#EA9D00'
      ctx.lineWidth = 2
      ctx.lineJoin = 'round'
      ctx.stroke()

      if (showBollinger) {
        ctx.beginPath()
        let upperStarted = false
        bars.forEach((bar, index) => {
          if (bar.bb_upper === null) {
            return
          }
          const x = cx(index)
          const y = py(bar.bb_upper)
          if (!upperStarted) {
            ctx.moveTo(x, y)
            upperStarted = true
          } else {
            ctx.lineTo(x, y)
          }
        })
        for (let index = bars.length - 1; index >= 0; index -= 1) {
          const bar = bars[index]
          if (bar.bb_lower === null) {
            continue
          }
          ctx.lineTo(cx(index), py(bar.bb_lower))
        }
        ctx.closePath()
        ctx.fillStyle = 'rgba(60,44,218,0.07)'
        ctx.fill()

        const strokeBand = (key: 'bb_upper' | 'bb_mid' | 'bb_lower', dash: number[]) => {
          ctx.beginPath()
          let started = false
          bars.forEach((bar, index) => {
            const value = bar[key]
            if (value === null) {
              return
            }
            const x = cx(index)
            const y = py(value)
            if (!started) {
              ctx.moveTo(x, y)
              started = true
            } else {
              ctx.lineTo(x, y)
            }
          })
          ctx.strokeStyle = 'rgba(60,44,218,0.55)'
          ctx.lineWidth = 1
          ctx.setLineDash(dash)
          ctx.stroke()
          ctx.setLineDash([])
        }
        strokeBand('bb_upper', [4, 3])
        strokeBand('bb_lower', [4, 3])
        ctx.globalAlpha = 0.8
        strokeBand('bb_mid', [1, 3])
        ctx.globalAlpha = 1
      }

      let maxVolume = 1
      for (const bar of bars) {
        maxVolume = Math.max(maxVolume, bar.v)
      }
      ctx.fillStyle = axis
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText('Vol', padL, volTop - 1)
      bars.forEach((bar, index) => {
        const up = bar.c >= bar.o
        const barHeight = (bar.v / maxVolume) * (volH - 6)
        ctx.fillStyle = up ? 'rgba(18,160,83,0.4)' : 'rgba(220,53,69,0.4)'
        ctx.fillRect(cx(index) - bw / 2, bandBottom - barHeight, bw, barHeight)
      })

      if (showRsi) {
        const ry = (value: number) => rsiTop + (1 - value / 100) * rsiH
        ctx.fillStyle = 'rgba(60,44,218,0.05)'
        ctx.fillRect(padL, ry(70), plotW, ry(30) - ry(70))
        ;[70, 50, 30].forEach((value) => {
          ctx.strokeStyle = value === 50 ? grid : '#D9DCF7'
          ctx.setLineDash(value === 50 ? [] : [3, 3])
          ctx.beginPath()
          ctx.moveTo(padL, ry(value))
          ctx.lineTo(padL + plotW, ry(value))
          ctx.stroke()
          ctx.setLineDash([])
          ctx.fillStyle = axis
          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.fillText(String(value), padL + plotW + 6, ry(value))
        })

        ctx.beginPath()
        let rsiStarted = false
        bars.forEach((bar, index) => {
          if (bar.rsi14 === null) {
            return
          }
          const x = cx(index)
          const y = ry(bar.rsi14)
          if (!rsiStarted) {
            ctx.moveTo(x, y)
            rsiStarted = true
          } else {
            ctx.lineTo(x, y)
          }
        })
        ctx.strokeStyle = '#3C2CDA'
        ctx.lineWidth = 1.5
        ctx.lineJoin = 'round'
        ctx.stroke()

        ctx.fillStyle = axis
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText('RSI 14', padL, rsiTop - 1)
        let lastRsi: number | null = null
        for (let index = bars.length - 1; index >= 0; index -= 1) {
          if (bars[index].rsi14 !== null) {
            lastRsi = bars[index].rsi14
            break
          }
        }
        if (lastRsi !== null) {
          ctx.fillStyle = '#3C2CDA'
          ctx.textAlign = 'right'
          ctx.font = `700 10px ${fontFamily}`
          ctx.fillText(lastRsi.toFixed(0), padL + plotW, rsiTop - 1)
          ctx.font = `10px ${fontFamily}`
        }
      }

      for (const level of priceLevels) {
        const y = py(level.price)
        ctx.strokeStyle = level.color
        ctx.setLineDash([5, 4])
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(padL, y)
        ctx.lineTo(padL + plotW, y)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = level.color
        ctx.fillRect(padL + plotW, y - 9, padR - 4, 18)
        ctx.fillStyle = '#fff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(level.price.toFixed(1), padL + plotW + (padR - 4) / 2, y)
      }

      const byDate = new Map(bars.map((bar, index) => [bar.date, index]))
      if (timeframe === 'D') {
        const commentMarkers = markers.filter((marker) => marker.kind === 'comment')
        commentMarkers.forEach((marker, offset) => {
          const index = byDate.get(marker.date) ?? Math.max(0, n - 1 - (offset * 3 + 1))
          const x = cx(index)
          ctx.fillStyle = marker.color || '#6B7280'
          ctx.beginPath()
          ctx.moveTo(x, priceTop + 9)
          ctx.lineTo(x - 4, priceTop + 2)
          ctx.lineTo(x + 4, priceTop + 2)
          ctx.closePath()
          ctx.fill()
        })
      }

      markers
        .filter((marker) => marker.kind === 'entry' || marker.kind === 'exit')
        .forEach((marker) => {
          const index = byDate.get(marker.date) ?? (marker.kind === 'exit' ? n - 1 : 0)
          const bar = bars[index]
          if (!bar) {
            return
          }
          const x = cx(index)
          const color = marker.color || (marker.kind === 'entry' ? '#3C2CDA' : '#12A053')
          const isEntry = marker.kind === 'entry'
          const y = isEntry ? py(bar.l) + 6 : py(bar.h) - 6
          ctx.fillStyle = color
          ctx.beginPath()
          if (isEntry) {
            ctx.moveTo(x, y)
            ctx.lineTo(x - 5, y + 8)
            ctx.lineTo(x + 5, y + 8)
          } else {
            ctx.moveTo(x, y)
            ctx.lineTo(x - 5, y - 8)
            ctx.lineTo(x + 5, y - 8)
          }
          ctx.closePath()
          ctx.fill()
          ctx.font = `700 10px ${fontFamily}`
          ctx.textAlign = 'center'
          ctx.textBaseline = isEntry ? 'top' : 'bottom'
          ctx.fillText(marker.label || (isEntry ? 'ENTRY' : 'EXIT'), x, isEntry ? y + 10 : y - 10)
        })

      if (hoverIndex !== null && bars[hoverIndex]) {
        const x = cx(hoverIndex)
        ctx.strokeStyle = '#CDD2D8'
        ctx.setLineDash([4, 4])
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, priceTop)
        ctx.lineTo(x, showRsi ? rsiBottom : bandBottom)
        ctx.stroke()

        if (hoverY !== null && hoverY >= priceTop && hoverY <= priceTop + priceH) {
          ctx.beginPath()
          ctx.moveTo(padL, hoverY)
          ctx.lineTo(padL + plotW, hoverY)
          ctx.stroke()
          ctx.setLineDash([])
          const price = lo + (1 - (hoverY - priceTop) / priceH) * (hi - lo)
          ctx.fillStyle = '#374151'
          ctx.fillRect(padL + plotW, hoverY - 9, padR - 4, 18)
          ctx.fillStyle = '#fff'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(price.toFixed(1), padL + plotW + (padR - 4) / 2, hoverY)
        } else {
          ctx.setLineDash([])
        }
      }
    }

    draw()
    const observer = new ResizeObserver(() => draw())
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [bars, chartStyle, hoverIndex, hoverY, markers, priceLevels, showBollinger, showRsi, timeframe])

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || !bars.length) {
      return
    }
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const padL = 10
    const padR = 58
    const plotW = Math.max(rect.width - padL - padR, 1)
    const cw = plotW / bars.length
    const nextIndex = Math.max(0, Math.min(bars.length - 1, Math.round((x - padL - cw / 2) / cw)))
    setHoverIndex(nextIndex)
    setHoverY(y)
  }

  if (!bars.length) {
    return <div className='ws-chart-empty'>No price data available.</div>
  }

  const activeIndex = hoverIndex ?? bars.length - 1
  const activeBar = bars[activeIndex]

  return (
    <div className='ws-chart-wrap'>
      {activeBar ? (
        <div className='ws-chart-hoverbar'>
          <div>
            <span>Date</span>
            <strong>{activeBar.date}</strong>
          </div>
          <div>
            <span>Open</span>
            <strong>{activeBar.o.toFixed(1)}</strong>
          </div>
          <div>
            <span>High</span>
            <strong>{activeBar.h.toFixed(1)}</strong>
          </div>
          <div>
            <span>Low</span>
            <strong>{activeBar.l.toFixed(1)}</strong>
          </div>
          <div>
            <span>Close</span>
            <strong>{activeBar.c.toFixed(1)}</strong>
          </div>
          <div>
            <span>44 MA</span>
            <strong className='ma'>{activeBar.ma44?.toFixed(1) ?? '-'}</strong>
          </div>
          {showRsi ? (
            <div>
              <span>RSI</span>
              <strong>{activeBar.rsi14?.toFixed(1) ?? '-'}</strong>
            </div>
          ) : null}
        </div>
      ) : null}

      <div ref={wrapRef} className='ws-chart-canvas-wrap'>
        <canvas
          ref={canvasRef}
          className='ws-chart-canvas'
          onPointerMove={onPointerMove}
          onPointerLeave={() => {
            setHoverIndex(null)
            setHoverY(null)
          }}
        />
      </div>

      <div className='ws-chart-legend-pills'>
        <span className='ws-pill-chip'>
          <i className='dot d1' />
          44 MA trend
        </span>
        {showBollinger ? (
          <span className='ws-pill-chip'>
            <i className='dot d2' />
            Bollinger range
          </span>
        ) : null}
        {showRsi ? (
          <span className='ws-pill-chip'>
            <i className='dot d3' />
            RSI momentum
          </span>
        ) : null}
        {timeframe === 'D' && markers.some((marker) => marker.kind === 'comment') ? (
          <span className='ws-pill-chip'>
            <i className='dot d4' />
            Comment markers
          </span>
        ) : (
          <span className='ws-pill-chip'>
            <i className='dot d4' />
            Hover for bar detail
          </span>
        )}
      </div>
    </div>
  )
}
