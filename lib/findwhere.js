// "Find where": several measures with cutoffs ("poverty at least 20 percent, median income at most $60,000"),
// answered with the areas that meet every one. Pure functions; the panel (findwhere-ui.js) loads the tables and draws.
//
// An estimate is a survey guess with a margin of error, so an area can meet a cutoff on the estimate while its
// 90 percent interval reaches across the line. Such areas are kept in the results but marked "near a cutoff",
// and counted apart, so a person is not told more than the data can say.
import { measureValue } from './measures.js'

export const OPS = {
  gte: 'at least',
  lte: 'at most',
  between: 'between',
}

/**
 * Whether an estimate with a margin of error meets one cutoff.
 * @param {{ op: 'gte' | 'lte' | 'between', a: number, b?: number }} cond
 * @param {number | null} est
 * @param {number | null} moe null when the source gives none (then the estimate is taken as exact)
 * @returns {{ ok: boolean, sure: boolean } | null} null when there is no value
 */
export function meets(cond, est, moe) {
  if (est === null || est === undefined || !Number.isFinite(est)) return null
  const m = moe ?? 0
  const lo = Math.min(cond.a, cond.b ?? cond.a)
  const hi = Math.max(cond.a, cond.b ?? cond.a)
  if (cond.op === 'gte') return { ok: est >= cond.a, sure: est - m >= cond.a || est + m < cond.a }
  if (cond.op === 'lte') return { ok: est <= cond.a, sure: est + m <= cond.a || est - m > cond.a }
  // between: inside [lo, hi]; sure when the whole interval is inside, or the whole interval is outside on one side.
  const ok = est >= lo && est <= hi
  const sure = ok ? est - m >= lo && est + m <= hi : est + m < lo || est - m > hi
  return { ok, sure }
}

/**
 * The areas that meet every condition.
 * @param {{ measure: object, table: ReturnType<import('./measures.js').indexTable>, op: 'gte' | 'lte' | 'between', a: number, b?: number }[]} conditions
 * @param {string[]} ids every area of the level and state
 * @returns {{
 *   total: number, noValue: number,
 *   matches: { id: string, name: string, values: { est: number | null, moe: number | null }[], sure: boolean }[],
 * }}
 */
export function findAreas(conditions, ids) {
  const matches = []
  let noValue = 0
  for (const id of ids) {
    const values = []
    let ok = true
    let sure = true
    let missing = false
    for (const c of conditions) {
      const v = measureValue(c.measure, c.table, id)
      values.push(v)
      const r = meets(c, v.est, v.moe)
      if (!r) {
        missing = true
        break
      }
      if (!r.ok) ok = false
      else if (!r.sure) sure = false
    }
    if (missing) {
      noValue++
      continue
    }
    if (ok) matches.push({ id, name: conditions[0].table.name(id), values, sure })
  }
  return { total: ids.length, noValue, matches }
}

/** The conditions in words, for the heading and the download. */
export function describeConditions(conditions, formatValue) {
  return conditions.map((c) => {
    const f = (x) => formatValue(x, c.measure.unit)
    const bound = c.op === 'between' ? `${f(Math.min(c.a, c.b))} and ${f(Math.max(c.a, c.b))}` : f(c.a)
    return `${c.measure.label} ${OPS[c.op]} ${bound}`
  })
}

/** The results as rows for a CSV or Excel file: one column of value and one of margin of error per condition. */
export function findGrid(conditions, result, notices = []) {
  const head = ['GEOID', 'Name']
  for (const c of conditions) head.push(`${c.measure.label} (${c.measure.unit})`, 'Margin of error (90%)')
  head.push('Near a cutoff')
  const grid = [head]
  for (const m of [...result.matches].sort((a, b) => a.id.localeCompare(b.id))) {
    grid.push([m.id, m.name, ...m.values.flatMap((v) => [v.est, v.moe]), m.sure ? 'no' : 'yes'])
  }
  for (const n of notices) grid.push([n])
  return grid
}
