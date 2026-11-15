// The comparison as SPSS syntax: the data between BEGIN DATA and END DATA, read with DATA LIST, then
// variable labels, so it runs in SPSS with nothing else to download. One row per place, an estimate
// column and a margin-of-error column (90 percent) per measure.
import { moeText, SHOW_MOE } from './format.js'
import { asciiText, sasName } from './sas.js'

const num = (x) => (x === null || x === undefined ? '' : String(x))

/**
 * @param {{ geoid: string, name: string }[]} places
 * @param {{ measure: { id: string, label: string, unit: string }, values: { est: number | null, moe: number | null }[] }[]} rows
 * @param {string[]} [notices] credit lines, written as comments
 */
export function toSpss(places, rows, notices = [], withMoe = SHOW_MOE) {
  const taken = new Set(['geoid', 'name'])
  const vars = rows.map((r) => {
    const est = sasName(r.measure.id, taken)
    const moe = sasName(est + '_moe', taken)
    return { est, moe, label: asciiText(r.measure.label).replaceAll("'", "''"), unit: r.measure.unit }
  })
  const out = []
  out.push(`* Husky Explorer: comparison of places. One row per place; for each measure ${withMoe ? 'an estimate and its margin of error at the 90 percent confidence level.' : 'an estimate.'}`)
  for (const n of notices.map((x) => moeText(x, withMoe)).filter(Boolean)) out.push(`* ${asciiText(n)}`)
  out.push('.')
  out.push('DATA LIST LIST(",") / geoid (A12) name (A120)' + vars.map((v) => ` ${v.est} (F16.4)${withMoe ? ` ${v.moe} (F16.4)` : ''}`).join('') + '.')
  out.push('BEGIN DATA')
  places.forEach((p, i) => {
    const cells = [p.geoid, `"${asciiText(p.name)}"`]
    for (const r of rows) cells.push(num(r.values[i].est), ...(withMoe ? [num(r.values[i].moe)] : []))
    out.push(cells.join(','))
  })
  out.push('END DATA.')
  out.push('VARIABLE LABELS geoid \'GEOID\' / name \'Place\'')
  for (const v of vars) {
    out.push(`  / ${v.est} '${v.label} (${v.unit}), estimate'`)
    if (withMoe) out.push(`  / ${v.moe} '${v.label}, margin of error (90%)'`)
  }
  out.push('  .')
  out.push('EXECUTE.')
  return out.join('\r\n') + '\r\n'
}
