// A Census table for one place, laid out the way the Bureau's table pages were: the indented
// categories, the estimate, its margin of error, and each row's share of the table's total.
import { formatValue } from './format.js'

/**
 * @param {{ variables: { id: string, label: string[], kind: string }[] }} table a table from the catalog
 * @param {{ cell: (geoid: string, id: string) => number | null }} values the place's value table, indexed
 * @param {string} geoid
 * @returns {{ id: string, depth: number, label: string, est: number | null, moe: number | null, share: number | null }[]}
 */
export function tableRows(table, values, geoid) {
  const rows = []
  for (const v of table.variables) {
    if (v.kind !== 'estimate') continue
    rows.push({
      id: v.id,
      depth: Math.max(0, v.label.length - 1),
      label: v.label.at(-1) ?? 'Total',
      est: values.cell(geoid, v.id),
      moe: values.cell(geoid, v.id.replace(/E$/, 'M')),
      share: null,
      unit: unitOf(table, v),
    })
  }
  // A share only means something for counts that nest under a first "Total" row.
  const root = rows[0]
  if (root && root.label === 'Total' && root.est && rows.length > 1) {
    for (const r of rows.slice(1)) r.share = r.est === null ? null : (100 * r.est) / root.est
  }
  return rows
}

function cell(x) {
  const s = x === null || x === undefined ? '' : String(x)
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

/** A table view as rows of cells: raw numbers, a blank for missing data, the credit lines at the end. */
export function tableGrid(title, place, rows, notices = []) {
  // Rows carry stateShare (the same line's percent of the state's total) when the state was available.
  const withState = rows.some((r) => r.stateShare !== undefined)
  const withBefore = rows.some((r) => r.before !== undefined)
  // And usShare, the same line's percent of the United States total, when the national figure was available.
  const withUs = rows.some((r) => r.usShare !== undefined)
  const pct = (x) => (x === null || x === undefined ? null : Number(x.toFixed(1)))
  const grid = [[`${title}: ${place}`], ['Line', 'Estimate', 'Margin of error (90%)', ...(withBefore ? ['Estimate 2015-2019'] : []), 'Percent of total', ...(withState ? ['Percent of total (state)'] : []), ...(withUs ? ['Percent of total (United States)'] : [])]]
  for (const r of rows) grid.push([`${'  '.repeat(r.depth)}${r.label}`, r.est, r.moe, ...(withBefore ? [r.before] : []), pct(r.share), ...(withState ? [pct(r.stateShare)] : []), ...(withUs ? [pct(r.usShare)] : [])])
  for (const n of notices) grid.push([n])
  return grid
}

/** CSV of a table view. */
export function tableCsv(title, place, rows, notices = []) {
  return tableGrid(title, place, rows, notices).map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n'
}
/** Dollar amounts (medians and per-capita income) are not counts, so they show a $. */
export function unitOf(table, variable) {
  const label = variable.label.join(' ')
  if (/dollars/i.test(label)) return 'dollars'
  return /^median/i.test(variable.label.at(-1) ?? '') && /dollars/i.test(table.concept ?? '') ? 'dollars' : 'count'
}

/**
 * How a number changed between two five-year estimates, and whether the change is larger than the
 * margins of error allow to be chance (the margins of the two estimates combine as the square root of
 * the sum of their squares).
 * @returns {{ diff: number, significant: boolean } | null}
 */
export function change(now, before) {
  if (now.est === null || before.est === null || now.est === undefined || before.est === undefined) return null
  const diff = now.est - before.est
  const margin = Math.hypot(now.moe ?? 0, before.moe ?? 0)
  return { diff, significant: Math.abs(diff) > margin }
}

/** "up $12,000", "down 2.1 points" or "no clear change", for the change between two estimates. */
export function changeText(c, unit) {
  if (!c.significant) return 'no clear change (within the margins of error)'
  const size = unit === 'percent' ? `${Math.abs(c.diff).toFixed(1)} points` : formatValue(Math.abs(c.diff), unit)
  return `${c.diff > 0 ? 'up' : 'down'} ${size}`
}

/**
 * A name for matching the same town or city across ACS years: the Bureau renamed some ("Amherst town" became
 * "Amherst Town city"), so the kind-of-place words after the name are dropped and the county and state kept.
 */
export function nameKey(name) {
  const [first = '', ...rest] = String(name).split(',')
  const base = first.replace(/(\s+(town|city|township|village|borough|cdp|municipality|plantation|gore|grant|purchase|location|comunidad|zona urbana|urbanizacion|barrio|district))+\s*$/i, '')
  return [base, ...rest].map((s) => s.trim().toLowerCase()).join('|')
}
