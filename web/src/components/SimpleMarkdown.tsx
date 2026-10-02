import { type ReactNode } from 'react'

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function inlineMarkdown(text: string): string {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

/** Lightweight markdown for AI replies (paragraphs, bullets, bold). */
export function renderSimpleMarkdown(text: string): ReactNode {
  const lines = text.split(/\r?\n/)
  const html: string[] = []
  let inList = false

  for (const line of lines) {
    const bullet = line.match(/^\s*(?:[-•*]|\d+\.)\s+(.*)/)
    if (bullet) {
      if (!inList) {
        html.push('<ul>')
        inList = true
      }
      html.push(`<li>${inlineMarkdown(bullet[1])}</li>`)
      continue
    }
    if (inList) {
      html.push('</ul>')
      inList = false
    }
    if (!line.trim()) {
      html.push('<div class="md-gap"></div>')
    } else {
      html.push(`<div>${inlineMarkdown(line)}</div>`)
    }
  }
  if (inList) html.push('</ul>')

  return <div className='md-body' dangerouslySetInnerHTML={{ __html: html.join('') }} />
}

export function detectSymbols(text: string, universe: string[]): string[] {
  const upper = text.toUpperCase()
  const isBoundary = (ch: string | undefined) => !ch || /[^A-Z0-9]/.test(ch)
  return universe.filter((symbol) => {
    const index = upper.indexOf(symbol.toUpperCase())
    if (index < 0) return false
    return isBoundary(upper[index - 1]) && isBoundary(upper[index + symbol.length])
  })
}
