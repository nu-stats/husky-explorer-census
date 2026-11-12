// The report builder: many measures at once for one to three places. The values come from the same
// code as the compare page; this adds what a report needs on top: why a cell is blank, the boundary
// vintages and levels the chosen measures belong to, and the sources carried into the download.
import { compare } from './compare.js'
import { LEVEL_NAMES } from './data.js'

export { compare as reportValues }

const API_NOTICE = 'This product uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau.'
const MOE_NOTICE = 'Margins of error, where given, are at the 90 percent confidence level. A blank is missing data, not zero.'

/** Why a measure has no number at a place: it is not published for that kind of area, or just has no estimate (or is not fetched). */
export function blankReason(measure, place) {
  if (measure.levels && !measure.levels.includes(place.level)) {
    const names = measure.levels.map((l) => ({ state: 'states', county: 'counties', cousub: 'towns', place: 'cities and places', zcta: 'ZIP code areas', tract: 'tracts', blockgroup: 'block groups' })[l] ?? l)
    const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]
    return `not available for this kind of area: the source publishes it for ${list} only`
  }
  return 'no estimate published, or not fetched for this place'
}

/** The measures grouped by the boundary set they belong to: [{ vintage, measures }], newest first. */
export function boundaryGroups(measures) {
  const by = new Map()
  for (const m of measures) {
    const v = m.vintage ?? 2024
    if (!by.has(v)) by.set(v, [])
    by.get(v).push(m)
  }
  return [...by].sort((a, b) => b[0] - a[0]).map(([vintage, ms]) => ({ vintage, measures: ms }))
}

/** Sentences for what the chosen measures and places cannot share on one map; empty when they can. */
export function mixNotes(measures, places) {
  const notes = []
  const groups = boundaryGroups(measures)
  if (groups.length > 1) {
    const parts = groups.map((g) => `${g.vintage} boundaries: ${g.measures.map((m) => m.label).join('; ')}`)
    notes.push(`These measures belong to different boundary sets (${parts.join(' | ')}), so they cannot be shown together on one map. Here each is a value for the place, side by side in a table; map them one boundary set at a time.`)
  }
  const levels = [...new Set(places.map((p) => p.level))]
  if (levels.length > 1) notes.push(`The places are different kinds of area (${levels.map((l) => LEVEL_NAMES[l] ?? l).join(', ')}), so their numbers describe areas of different sizes and cannot be shown together on one map.`)
  for (const m of measures) {
    const off = places.filter((p) => m.levels && !m.levels.includes(p.level))
    if (off.length) notes.push(`${m.label} is not published for ${off.map((p) => p.name).join(', ')} (${m.levels.join(', ')} only); those cells are blank.`)
  }
  return notes
}

/** The credit and notice lines for a download: one source line per measure's credit, once each. */
export function reportNotices(measures) {
  return [
    ...new Set(measures.map((m) => m.credit).filter(Boolean)),
    API_NOTICE,
    MOE_NOTICE,
  ]
}

/** The report as rows of cells: raw numbers, a blank for missing data, and each measure's boundaries and note. */
export function reportGrid(places, rows, notices = []) {
  const head = ['Measure', 'Group', 'Unit', 'Boundaries']
  for (const p of places) head.push(`${p.name} estimate`, `${p.name} margin of error (90%)`)
  head.push('Notes')
  const grid = [head]
  for (const r of rows) {
    const m = r.measure
    const notes = [m.note, ...places.map((p, i) => (r.values[i].est === null ? `${p.name}: ${blankReason(m, p)}` : null))].filter(Boolean).join(' ')
    const cells = [m.label, m.group ?? 'Census', m.unit, m.vintage ?? 2024]
    for (const v of r.values) cells.push(v.est, v.moe)
    cells.push(notes)
    grid.push(cells)
  }
  for (const n of notices) grid.push([n])
  return grid
}

function csvCell(x) {
  const s = x === null || x === undefined ? '' : String(x)
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

export const reportCsv = (grid) => grid.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
