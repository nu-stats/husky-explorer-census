// The map's data as files: every area of the level on screen with the value the map colors it by.

import { moeText, SHOW_MOE, withoutMoe } from './format.js'

const API_NOTICE = 'This product uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau.'

/** The credit lines for a download of a measure (the source's own, then the Census notice). */
export function mapNotices(measure, level, state) {
  return [
    moeText(`${measure.label}, by ${level}, ${state === 'all' ? 'all states' : 'state ' + state}. Margins of error, where given, are at the 90 percent confidence level.`),
    ...(measure.credit ? [measure.credit] : []),
    API_NOTICE,
    'Boundaries: U.S. Census Bureau cartographic boundary files (1:500,000).',
  ]
}

/** @param {Map<string, { name: string, est: number | null, moe: number | null }>} values */
export function mapGrid(measure, values, notices = []) {
  const grid = [['GEOID', 'Name', `${measure.label} (${measure.unit})`, 'Margin of error (90%)']]
  for (const id of [...values.keys()].sort()) {
    const v = values.get(id)
    grid.push([id, v.name ?? '', v.est, v.moe])
  }
  for (const n of notices) grid.push([n])
  return grid
}

function csvCell(x) {
  const s = x === null || x === undefined ? '' : String(x)
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

export const mapCsv = (grid) => withoutMoe(grid).map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'

/**
 * The boundary file with the values added to each area's properties, as GeoJSON (longitude and latitude).
 * @param {{ features: { properties: { id: string, name: string }, geometry: object }[] }} geometry
 */
export function mapGeoJson(measure, geometry, values, notices = []) {
  return {
    type: 'FeatureCollection',
    notice: notices.map((n) => moeText(n)).filter(Boolean).join(' '),
    features: geometry.features.map((f) => {
      const v = values.get(f.properties.id)
      return {
        type: 'Feature',
        properties: { GEOID: f.properties.id, name: v?.name || f.properties.name, value: v?.est ?? null, ...(SHOW_MOE ? { margin_of_error: v?.moe ?? null } : {}), measure: measure.label, unit: measure.unit },
        geometry: f.geometry,
      }
    }),
  }
}

/** The map's table as columns and rows for the Stata and R writers (and the hand-off): the ID and name as text, the value and its margin as numbers. */
export function mapTable(measure, values) {
  const columns = [
    { name: 'GEOID', label: 'Census area ID', type: 'text' },
    { name: 'Name', label: 'Area name', type: 'text' },
    { name: 'value', label: `${measure.label} (${measure.unit})`, type: 'double' },
    ...(SHOW_MOE ? [{ name: 'moe', label: `${measure.label}, margin of error (90%)`, type: 'double' }] : []),
  ]
  const rows = [...values.keys()].sort().map((id) => [id, values.get(id).name ?? '', values.get(id).est, ...(SHOW_MOE ? [values.get(id).moe] : [])])
  return { columns, rows }
}
