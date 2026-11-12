// Comparing places: the numbers for a set of places side by side, which pairs
// differ by more than chance, and the CSV of the result.

import { measureValue } from './measures.js'

/** The 90 percent confidence level's critical value, the Census Bureau's standard. */
export const Z90 = 1.645

/**
 * Whether two estimates differ by more than their margins of error allow
 * (the Census Bureau's test: |a - b| / sqrt(seA^2 + seB^2) > 1.645, where each
 * standard error is its margin / 1.645). null when either margin is unknown,
 * as for a decennial count or an ACS controlled total, since the test cannot be run.
 */
export function differs(a, b) {
  if (a.est === null || b.est === null || a.moe === null || b.moe === null) return null
  const se = Math.hypot(a.moe, b.moe) / Z90
  if (se === 0) return a.est !== b.est
  return Math.abs(a.est - b.est) / se > Z90
}

/**
 * @param {import('./measures.js').Measure[]} measures
 * @param {{ geoid: string, level: string, name: string }[]} places
 * @param {(m: import('./measures.js').Measure, level: string, state: string) => Promise<ReturnType<import('./measures.js').indexTable>>} getTable
 * @returns one row per measure: { measure, values: [{ est, moe }], pairs: [[i, j, differs]] }
 */
export async function compare(measures, places, getTable) {
  const rows = []
  for (const measure of measures) {
    const values = []
    for (const p of places) values.push(measureValue(measure, await getTable(measure, p.level, p.geoid.slice(0, 2)), p.geoid))
    const pairs = []
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) pairs.push([i, j, differs(values[i], values[j])])
    }
    rows.push({ measure, values, pairs })
  }
  return rows
}

function csvCell(x) {
  const s = x === null || x === undefined ? '' : String(x)
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

/** The comparison as rows of cells: an estimate and a margin of error column per place; raw numbers, no formatting. */
export function compareGrid(places, rows, notices = []) {
  const head = ['Measure', 'Unit']
  for (const p of places) head.push(`${p.name} estimate`, `${p.name} margin of error (90%)`)
  const grid = [head]
  for (const r of rows) {
    const cells = [r.measure.label, r.measure.unit]
    for (const v of r.values) cells.push(v.est, v.moe)
    grid.push(cells)
  }
  for (const n of notices) grid.push([n])
  return grid
}

/** CSV of the comparison. */
export function toCsv(places, rows, notices = []) {
  return compareGrid(places, rows, notices).map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
