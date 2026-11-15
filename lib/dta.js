// A Stata .dta file (format 114, Stata 10 to 12, which Stata, R, Python and StatCraft-style readers all open) written by hand:
// variable names, labels and real missing values, so a table opens in Stata with nothing to retype. Numbers are doubles; text
// is fixed-width Latin-1 (what the format holds). No value labels.
import { asciiText, sasName } from './sas.js'

const HEADER_BYTES = 1 + 1 + 1 + 1 + 2 + 4 + 81 + 18
const MISSING_DOUBLE = [0, 0, 0, 0, 0, 0, 0xe0, 0x7f] // Stata's "." for a double

/** Text the format can hold: ASCII, no control characters, cut to `n` bytes. */
const latin = (s, n) => asciiText(String(s ?? '')).replace(/[\u0000-\u001f]/g, ' ').slice(0, n)

/**
 * @param {{ name: string, label?: string, type: 'double' | 'text' }[]} columns
 * @param {(string | number | null)[][]} rows one array per row, in column order
 * @param {string} [dataLabel] up to 80 characters
 * @returns {Uint8Array}
 */
export function toDta(columns, rows, dataLabel = '') {
  const taken = new Set()
  const names = columns.map((c) => sasName(c.name, taken))
  const widths = columns.map((c, i) => (c.type === 'text' ? Math.min(244, Math.max(1, ...rows.map((r) => latin(r[i], 244).length))) : 8))
  const nvar = columns.length
  const nobs = rows.length
  const rowSize = widths.reduce((s, w) => s + w, 0)
  const total = HEADER_BYTES + nvar + nvar * 33 + (nvar + 1) * 2 + nvar * 49 + nvar * 33 + nvar * 81 + 5 + nobs * rowSize
  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)
  let at = 0
  const put = (bytes) => {
    out.set(bytes, at)
    at += bytes.length
  }
  const fixed = (text, n) => {
    const b = new Uint8Array(n)
    for (let i = 0; i < Math.min(text.length, n - 1); i++) b[i] = text.charCodeAt(i) & 0xff
    put(b)
  }
  put([114, 2, 1, 0]) // format, little-endian, file type, unused
  view.setInt16(at, nvar, true)
  at += 2
  view.setInt32(at, nobs, true)
  at += 4
  fixed(latin(dataLabel, 80), 81)
  fixed('01 Jan 2000 00:00', 18)
  put(columns.map((c, i) => (c.type === 'text' ? widths[i] : 255))) // types: str# or double
  for (const n of names) fixed(n, 33)
  at += (nvar + 1) * 2 // sort list: none
  columns.forEach((c, i) => fixed(c.type === 'text' ? `%${widths[i]}s` : '%12.0g', 49))
  at += nvar * 33 // value-label names: none
  for (const c of columns) fixed(latin(c.label ?? '', 80), 81)
  at += 5 // expansion fields: the terminator
  for (const r of rows) {
    columns.forEach((c, i) => {
      if (c.type === 'text') {
        const s = latin(r[i], widths[i])
        for (let k = 0; k < widths[i]; k++) out[at + k] = k < s.length ? s.charCodeAt(k) & 0xff : 0
        at += widths[i]
      } else {
        const v = r[i]
        if (typeof v === 'number' && Number.isFinite(v)) view.setFloat64(at, v, true)
        else out.set(MISSING_DOUBLE, at)
        at += 8
      }
    })
  }
  return out
}
