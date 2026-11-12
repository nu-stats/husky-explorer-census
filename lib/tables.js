// The Data tables page: pick a source, then a table, then an area, and read or download the whole table.
import { mapCsv } from './mapdata.js'

/** Tables of a catalog whose id or concept contains every word of the search, in catalog order. */
export function searchTables(catalog, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return catalog.tables.filter((t) => {
    const hay = `${t.id} ${t.concept}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}

/** The column heading of a variable: its label path, with "margin of error" marked on the margin columns. */
export function columnLabel(v) {
  const path = v.label.length ? v.label.join(': ') : v.concept
  return v.kind === 'moe' ? `${path} (margin of error ±)` : path
}

/**
 * Rows for display and download: area name, GEOID, then one column per variable in the value file.
 * Missing values are null (shown blank), never zero.
 * @param {{ variables: string[], rows: Record<string, { n: string, v: (number|null)[] }> }} file
 * @param {{ variables: { id: string, label: string[], concept: string, kind: string }[] }} table the catalog entry
 * @param {string} [filter] keeps areas whose name contains this text
 */
export function tableGrid(file, table, filter = '') {
  const byId = new Map(table.variables.map((v) => [v.id, v]))
  const head = ['Area', 'GEOID', ...file.variables.map((id) => (byId.has(id) ? columnLabel(byId.get(id)) : id))]
  const q = filter.trim().toLowerCase()
  const body = Object.entries(file.rows)
    .filter(([, r]) => !q || r.n.toLowerCase().includes(q))
    .sort((a, b) => a[1].n.localeCompare(b[1].n))
    .map(([geoid, r]) => [r.n, geoid, ...r.v.map((x) => x ?? '')])
  return [head, ...body]
}

/** CSV of a grid with the Census notice as a final line, as the other downloads do. */
export function tableCsv(grid, notice) {
  return mapCsv([...grid, [notice]])
}

/**
 * Several tables as one grid for download: each starts with a line giving its source and name, and a blank line separates them.
 * @param {{ title: string, grid: (string | number | null)[][] }[]} parts
 */
export function stackGrids(parts) {
  const out = []
  for (const p of parts) {
    if (out.length) out.push([])
    out.push([p.title], ...p.grid)
  }
  return out
}
