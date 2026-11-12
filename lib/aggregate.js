// The aggregation assistant's engine: going from the rows a person has (tracts, say) to a larger level (counties),
// honestly. What can be added up depends on the kind of number, so each column is asked about. A median is never
// built from smaller medians. Levels that nest are joined by code, exactly; nothing here uses geometry.
import { toNumber } from './join.js'
import { levelWord } from './match.js'

/** The larger levels a level nests in, by the start of its ID (state 2 digits, county 5, tract 11). */
export const NESTS = {
  blockgroup: { tract: 11, county: 5, state: 2 },
  tract: { county: 5, state: 2 },
  cousub: { county: 5, state: 2 },
  county: { state: 2 },
}

/** The ID of the larger area a row belongs to. */
export const parentOf = (geoid, to, from) => geoid.slice(0, NESTS[from][to])

/** The levels a file at `level` can be shown at without geometry. */
export const upLevels = (level) => Object.keys(NESTS[level] ?? {})

export const KINDS = {
  count: { name: 'A count', hint: 'people, households, dollars of a total: added up' },
  rate: { name: 'A rate or percent', hint: 'combined as an average weighted by a base' },
  mean: { name: 'An average or index', hint: 'combined as an average weighted by a base' },
  median: { name: 'A median', hint: 'cannot be built from smaller medians' },
  skip: { name: 'Leave it out', hint: 'text or categories' },
}

/**
 * A first guess at what a column is, from its name and values. The person confirms it.
 * @param {string} header
 * @param {string[]} values
 * @returns {'count' | 'rate' | 'mean' | 'median'}
 */
export function guessKind(header, values) {
  const h = header.toLowerCase()
  if (/median/.test(h)) return 'median'
  if (/rate|percent|pct|%|share|ratio|prop(ortion)?\b|per ?(100|1,?000|capita)/.test(h)) return 'rate'
  if (/mean|average|avg|index|score|rank|ratio/.test(h)) return 'mean'
  const nums = values.map(toNumber).filter((x) => x !== null)
  if (nums.length && nums.every((x) => x >= 0 && x <= 100) && nums.some((x) => !Number.isInteger(x))) return 'rate'
  return 'count'
}

/**
 * @typedef {{ col: number, kind: 'count' | 'rate' | 'mean' | 'median' | 'skip', weight?: { column: number } | { census: true } }} ColumnSpec
 * @typedef {{ values: Map<string, (number | null)[]>, columns: { spec: ColumnSpec, label: string, how: string, left: string | null }[],
 *   coverage: { parents: number, partial: number }, children: Map<string, number> }} Aggregated
 */

const describeWeight = (w, headers, censusName) => ('census' in w ? censusName : `the column “${headers[w.column]}”`)

/**
 * Aggregates the rows to a larger level.
 * @param {Map<string, string[]>} rows the file's rows by ID
 * @param {string} from the file's level
 * @param {string} to the larger level
 * @param {string[]} headers
 * @param {ColumnSpec[]} specs
 * @param {{ census?: Map<string, number> | null, censusName?: string, childIds?: Iterable<string> | null }} [ctx]
 *   census: the weight for "census population" by ID at the file's level; childIds: every area of the file's level
 *   in the state, to say how much of each larger area the rows cover
 * @returns {Aggregated}
 */
export function aggregate(rows, from, to, headers, specs, ctx = {}) {
  if (!NESTS[from]?.[to]) throw new Error(`${levelWord(from)} do not nest in ${levelWord(to)} by code.`)
  const censusName = ctx.censusName ?? 'the census population'
  const parents = new Map() // parent -> { n, sums: per column, weights: per column }
  const used = specs.filter((s) => s.kind !== 'skip')
  for (const [id, row] of rows) {
    const p = parentOf(id, to, from)
    if (!parents.has(p)) parents.set(p, { n: 0, sum: used.map(() => null), den: used.map(() => 0) })
    const slot = parents.get(p)
    slot.n++
    used.forEach((s, i) => {
      const v = toNumber(row[s.col])
      if (v === null) return
      if (s.kind === 'count') slot.sum[i] = (slot.sum[i] ?? 0) + v
      else if (s.kind === 'rate' || s.kind === 'mean') {
        const w = !s.weight ? null : 'census' in s.weight ? (ctx.census?.get(id) ?? null) : toNumber(row[s.weight.column])
        if (w === null || w <= 0) return
        slot.sum[i] = (slot.sum[i] ?? 0) + v * w
        slot.den[i] += w
      }
    })
  }
  const values = new Map()
  const children = new Map()
  for (const [p, slot] of parents) {
    children.set(p, slot.n)
    values.set(
      p,
      used.map((s, i) => {
        if (s.kind === 'median' || slot.sum[i] === null) return null
        if (s.kind === 'count') return slot.sum[i]
        return slot.den[i] > 0 ? Math.round((slot.sum[i] / slot.den[i]) * 1e4) / 1e4 : null
      }),
    )
  }
  const columns = specs.map((s) => {
    const label = headers[s.col] || `Column ${s.col + 1}`
    if (s.kind === 'skip') return { spec: s, label, how: '', left: 'left out, as you asked' }
    if (s.kind === 'median') return { spec: s, label, how: '', left: 'a median cannot be built from smaller medians. For a census measure, show the map at the larger level: the Bureau publishes the median there directly.' }
    if (s.kind === 'count') return { spec: s, label: `${label} (added up)`, how: `summed the column “${label}” for the ${levelWord(from)} in each ${to === 'state' ? 'state' : to === 'county' ? 'county' : to}`, left: null }
    if (!s.weight) return { spec: s, label, how: '', left: 'a rate or average needs a base to weight by (a count column, or the census population); none was chosen' }
    return { spec: s, label: `${label} (weighted average)`, how: `averaged the column “${label}” over the ${levelWord(from)} in each ${to}, weighted by ${describeWeight(s.weight, headers, censusName)}`, left: null }
  })
  // How much of each larger area the rows cover, when the full list of areas is known.
  let partial = 0
  if (ctx.childIds) {
    const total = new Map()
    for (const id of ctx.childIds) {
      const p = parentOf(id, to, from)
      total.set(p, (total.get(p) ?? 0) + 1)
    }
    for (const [p, n] of children) if (n < (total.get(p) ?? n)) partial++
  }
  return { values, columns, coverage: { parents: parents.size, partial }, children }
}

/** The measure tables the map reads, one per column that could be combined: { variables, rows }, in the order of `agg.columns`. */
export function aggregatedTables(agg, names, ids) {
  const used = agg.columns.filter((c) => c.spec.kind !== 'skip')
  const out = []
  used.forEach((c, i) => {
    if (c.left) return
    const rows = {}
    for (const [p, v] of agg.values) if (v[i] !== null && v[i] !== undefined) rows[p] = { n: names?.get(p) ?? p, v: [v[i]] }
    out.push({ column: c, table: { variables: [ids(c)], rows } })
  })
  return out
}

/** Plain-text lines for the recipe log. */
export function aggregateRecipe(agg, from, to) {
  const lines = [`Showed the ${levelWord(from)} at the ${to} level (they nest by code, so nothing is estimated from shapes).`]
  for (const c of agg.columns) lines.push(c.left ? `Left out “${c.label}”: ${c.left.replace(/\.$/, '')}.` : `${c.how[0].toUpperCase()}${c.how.slice(1)}.`)
  if (agg.coverage.partial) lines.push(`${agg.coverage.partial} of ${agg.coverage.parents} ${to === 'county' ? 'counties' : levelWord(to)} have rows for only some of their ${levelWord(from)}, so their added-up counts are lower than the true totals.`)
  return lines
}
