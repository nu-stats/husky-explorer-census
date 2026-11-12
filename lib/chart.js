// A sheet of small bar charts, one per measure, as an SVG string: a bar for each
// place with its margin of error as a whisker. The same string is shown on the
// page and turned into the PNG, so what you see is what you save.

import { formatValue } from './format.js'

/** Colors for up to three places, chosen to stay apart for the common kinds of color blindness. */
export const PLACE_COLORS = ['#1f77b4', '#e08a00', '#2a9d8f']

export function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
}

/** A round upper limit for an axis that holds `max`. */
export function niceMax(max) {
  if (!(max > 0)) return 1
  const p = 10 ** Math.floor(Math.log10(max))
  const f = max / p
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p
}

/**
 * @param {{ name: string }[]} places
 * @param {{ measure: { label: string, unit: string }, values: { est: number | null, moe: number | null }[] }[]} rows
 */
export function chartSheet(places, rows, { panelW = 380, panelH = 190, cols = 2 } = {}) {
  const pad = 16
  const titleH = 22
  const legendH = 28
  const nRows = Math.ceil(rows.length / cols)
  const W = pad + cols * (panelW + pad)
  const H = legendH + pad + nRows * (panelH + pad)
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="system-ui, sans-serif" font-size="12" role="img" aria-label="Bar charts comparing places">`]
  // Legend.
  let lx = pad
  places.forEach((p, i) => {
    out.push(`<rect x="${lx}" y="8" width="12" height="12" fill="${PLACE_COLORS[i]}"/><text x="${lx + 18}" y="18" fill="currentColor">${esc(p.name)}</text>`)
    lx += 18 + 7 * p.name.length + 24
  })
  rows.forEach((r, k) => {
    const x0 = pad + (k % cols) * (panelW + pad)
    const y0 = legendH + pad + Math.floor(k / cols) * (panelH + pad)
    const unit = r.measure.unit
    out.push(`<g transform="translate(${x0},${y0})">`)
    out.push(`<text x="0" y="14" font-weight="600" fill="currentColor">${esc(r.measure.label)}</text>`)
    const top = titleH + 18
    const bottom = panelH - 8
    const plotH = bottom - top
    const max = niceMax(Math.max(...r.values.map((v) => (v.est ?? 0) + (v.moe ?? 0))))
    const y = (value) => bottom - (value / max) * plotH
    out.push(`<line x1="0" y1="${bottom}" x2="${panelW}" y2="${bottom}" stroke="currentColor" stroke-opacity="0.4"/>`)
    const slot = panelW / places.length
    const barW = Math.min(70, slot * 0.55)
    r.values.forEach((v, i) => {
      const cx = slot * i + slot / 2
      if (v.est === null) {
        out.push(`<text x="${cx}" y="${bottom - 6}" text-anchor="middle" fill="currentColor" fill-opacity="0.6" font-style="italic">no data</text>`)
        return
      }
      const yTop = y(v.est)
      out.push(`<rect x="${cx - barW / 2}" y="${yTop}" width="${barW}" height="${Math.max(0, bottom - yTop)}" fill="${PLACE_COLORS[i]}"/>`)
      let labelY = yTop - 4
      if (v.moe !== null && v.moe > 0) {
        const lo = y(Math.max(0, v.est - v.moe))
        const hi = y(v.est + v.moe)
        out.push(`<path d="M${cx} ${hi}V${lo}M${cx - 6} ${hi}H${cx + 6}M${cx - 6} ${lo}H${cx + 6}" stroke="currentColor" stroke-width="1.5" fill="none"/>`)
        labelY = hi - 4
      }
      out.push(`<text x="${cx}" y="${Math.max(top - 2, labelY)}" text-anchor="middle" fill="currentColor">${esc(formatValue(v.est, unit))}</text>`)
    })
    out.push('</g>')
  })
  out.push('</svg>')
  return out.join('')
}
