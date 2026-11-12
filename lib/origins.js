// Where people were born: the countries of birth of a place's foreign-born
// residents (ACS table B05006), added up over a set of counties when a whole
// state is asked for. Margins of error add as the square root of the sum of
// squares (the Census Bureau's rule for sums), and a total is never spread
// across places that were not counted.
import { moeOfSum } from './moe.js'

/**
 * The country-of-birth columns of B05006: the variables that have no more
 * detailed variable beneath them (regions and "Total" are left out).
 * @param {{ id: string, label: string[], kind: string }[]} variables from the catalog
 * @returns {{ id: string, name: string, region: string }[]} ids without the E or M suffix
 */
export function countryColumns(variables) {
  const estimates = variables.filter((v) => v.kind === 'estimate' && v.label.length > 1)
  const paths = estimates.map((v) => v.label.join('\u0000'))
  return estimates
    .filter((v, i) => !paths.some((p, j) => j !== i && p.startsWith(paths[i] + '\u0000')))
    .map((v) => ({ id: v.id.replace(/E$/, ''), name: v.label.at(-1), region: v.label[1] }))
}

/**
 * The most common countries of birth across some tables (one per county).
 * @param {{ id: string, name: string, region: string }[]} columns
 * @param {{ file: { rows: Record<string, unknown> }, cell: (geoid: string, id: string) => number | null }[]} tables
 * @param {string[] | null} geoids the places to add up, or null for every place in the tables
 * @param {number} n how many countries to return
 */
export function topOrigins(columns, tables, geoids, n) {
  const sum = (id) => {
    let est = 0
    const moes = []
    for (const t of tables) {
      for (const geoid of geoids ?? Object.keys(t.file.rows)) {
        const e = t.cell(geoid, id + 'E')
        if (e === null) continue
        est += e
        moes.push(t.cell(geoid, id + 'M'))
      }
    }
    return { est, moe: moes.length ? moeOfSum(moes) : null }
  }
  const total = sum('B05006_001')
  const rows = columns
    .map((c) => ({ ...c, ...sum(c.id) }))
    .filter((r) => r.est > 0)
    .sort((a, b) => b.est - a.est || a.name.localeCompare(b.name))
    .slice(0, n)
    .map((r) => ({ ...r, share: total.est > 0 ? (100 * r.est) / total.est : null }))
  return { total, rows }
}
