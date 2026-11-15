// The comparison as a Stata do-file: the data typed in with `input`, then variable labels, so it runs
// in Stata with nothing else to download. Same layout as the SAS program: one row per place, an estimate
// column and a margin-of-error column (90 percent) per measure.
import { moeText, SHOW_MOE } from './format.js'
import { asciiText, sasName } from './sas.js'

const num = (x) => (x === null || x === undefined ? '.' : String(x))

/**
 * @param {{ geoid: string, name: string }[]} places
 * @param {{ measure: { id: string, label: string, unit: string }, values: { est: number | null, moe: number | null }[] }[]} rows
 * @param {string[]} [notices] credit lines, written as comments
 */
export function toStata(places, rows, notices = [], withMoe = SHOW_MOE) {
  const taken = new Set(['geoid', 'name'])
  const vars = rows.map((r) => {
    const est = sasName(r.measure.id, taken) // Stata names follow the same rules: letters, digits, underscores, 32 at most
    const moe = sasName(est + '_moe', taken)
    return { est, moe, label: asciiText(r.measure.label), unit: r.measure.unit }
  })
  // A variable label holds 80 characters.
  const label = (s) => s.slice(0, 80)
  const out = []
  out.push(`* Husky Explorer: comparison of places. One row per place; for each measure ${withMoe ? 'an estimate and its margin of error at the 90 percent confidence level.' : 'an estimate.'}`)
  for (const n of notices.map((x) => moeText(x, withMoe)).filter(Boolean)) out.push(`* ${asciiText(n)}`)
  out.push('clear')
  out.push(`input str12 geoid str120 name${vars.map((v) => ` double ${v.est}${withMoe ? ` double ${v.moe}` : ''}`).join('')}`)
  places.forEach((p, i) => {
    const cells = [`"${p.geoid}"`, `"${asciiText(p.name)}"`]
    for (const r of rows) cells.push(num(r.values[i].est), ...(withMoe ? [num(r.values[i].moe)] : []))
    out.push(cells.join(' '))
  })
  out.push('end')
  out.push('label variable geoid "GEOID"')
  out.push('label variable name "Place"')
  for (const v of vars) {
    out.push(`label variable ${v.est} "${label(`${v.label} (${v.unit}), estimate`)}"`)
    if (withMoe) out.push(`label variable ${v.moe} "${label(`${v.label}, margin of error (90%)`)}"`)
  }
  out.push('describe')
  return out.join('\r\n') + '\r\n'
}
