// Reads a table the user brings (CSV) and joins it to census areas by GEOID. Runs in the browser; the file is never sent anywhere.

const LEVEL_BY_LENGTH = { 5: 'county', 11: 'tract', 12: 'blockgroup' }

/**
 * Splits CSV text into rows of cells. Handles quotes, doubled quotes, commas and line breaks
 * inside quotes, a leading byte-order mark, and CRLF line ends.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ''))
}

/**
 * A number from a cell as people write it ("1,234", "$5,000", "12.5%"), or null.
 * @param {string} s
 */
export function toNumber(s) {
  const t = String(s ?? '').trim().replace(/^\$/, '').replace(/,/g, '').replace(/%$/, '')
  if (t === '' || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return null
  return Number(t)
}

/**
 * Turns an identifier as it was typed into a GEOID, or null. Accepts the Census "1400000US25025…"
 * form, and restores the leading zero a spreadsheet drops from state codes below 10 (a 4-digit
 * county code, a 10-digit tract code, an 11-digit block group code reads as a tract if it is
 * not 12 long).
 * @param {string} raw
 * @returns {{ geoid: string, level: 'county'|'tract'|'blockgroup', padded: boolean } | null}
 */
export function toGeoid(raw) {
  let s = String(raw ?? '').trim()
  const us = s.indexOf('US')
  if (us > 0 && /^\d+$/.test(s.slice(0, us))) s = s.slice(us + 2)
  if (!/^\d+$/.test(s)) return null
  if (s.length === 4) return { geoid: '0' + s, level: 'county', padded: true }
  if (s.length === 10) return { geoid: '0' + s, level: 'tract', padded: true }
  if (s.length === 11) return { geoid: s, level: 'tract', padded: false }
  if (s.length === 5 || s.length === 12) return { geoid: s, level: LEVEL_BY_LENGTH[s.length], padded: false }
  return null
}

/**
 * Reads a CSV: finds the column that holds GEOIDs, and the columns that hold numbers.
 * @param {string} text
 * @returns {{ headers: string[], idColumn: number, level: 'county'|'tract'|'blockgroup', numeric: number[],
 *   rows: Map<string, string[]>, padded: number, skipped: number, duplicates: number }}
 */
export function readUpload(text) {
  const all = parseCsv(text)
  if (all.length < 2) throw new Error('The file needs a header row and at least one row of data.')
  const headers = all[0].map((h) => h.trim())
  const body = all.slice(1)
  // The identifier column is the one where most cells read as GEOIDs, preferring one named like it.
  let best = -1
  let bestScore = 0
  headers.forEach((h, c) => {
    const ok = body.filter((r) => toGeoid(r[c])).length / body.length
    const named = /geo.?id|fips|^id$|tract|county/i.test(h) ? 0.1 : 0
    if (ok >= 0.8 && ok + named > bestScore) {
      best = c
      bestScore = ok + named
    }
  })
  if (best < 0) throw new Error('No column looks like a GEOID. A county code has 5 digits, a tract 11, a block group 12.')
  // One level per file: the most common.
  const counts = {}
  for (const r of body) {
    const g = toGeoid(r[best])
    if (g) counts[g.level] = (counts[g.level] ?? 0) + 1
  }
  const level = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
  const rows = new Map()
  let padded = 0
  let skipped = 0
  let duplicates = 0
  for (const r of body) {
    const g = toGeoid(r[best])
    if (!g || g.level !== level) {
      skipped++
      continue
    }
    if (rows.has(g.geoid)) duplicates++
    if (g.padded) padded++
    rows.set(g.geoid, r)
  }
  const numeric = headers
    .map((_, c) => c)
    .filter((c) => c !== best && body.filter((r) => toNumber(r[c]) !== null).length / body.length >= 0.8)
  return { headers, idColumn: best, level, numeric, rows, padded, skipped, duplicates }
}

/**
 * The table for one numeric column, in the shape the map reads: { variables, rows }.
 * @param {ReturnType<typeof readUpload>} up
 * @param {number} column
 * @param {string} id
 */
export function uploadTable(up, column, id) {
  const rows = {}
  for (const [geoid, r] of up.rows) rows[geoid] = { n: geoid, v: [toNumber(r[column])] }
  return { variables: [id], rows }
}

/**
 * How well the upload matched the areas on the map.
 * @param {Iterable<string>} uploaded GEOIDs in the file
 * @param {Set<string>} known GEOIDs of the areas drawn (the chosen state at that level)
 * @param {string} state two-digit state code
 */
export function joinReport(uploaded, known, state) {
  let matched = 0
  let otherState = 0
  const missing = []
  let total = 0
  for (const g of uploaded) {
    total++
    if (known.has(g)) matched++
    else if (!g.startsWith(state)) otherState++
    else if (missing.length < 5) missing.push(g)
  }
  return { total, matched, otherState, unmatched: total - matched - otherState, examples: missing, noData: Math.max(0, known.size - matched) }
}
