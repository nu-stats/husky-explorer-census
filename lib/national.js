// The two whole-country options: "All states" (the map drawn at the state level, every state at once) and
// "United States" (the national figure, a comparison reference beside a place's or a state's value).

/** The State picker's value for every state at once. */
export const ALL_STATES = 'all'
/** The ID of the national row, as filed by the build (<dataset>/us/US/<table>.json). */
export const US = 'US'
export const US_NAME = 'United States'

export const US_NOTICE =
  'United States: the Census Bureau’s own published national figure (the Data API’s whole-country answer), not a sum of the states. Where a source has no national figure the cell is blank, never zero.'

/**
 * One value file made of several states' files (every state's state-level row, for the All states map).
 * The first file sets the columns; a file that lacks one of them leaves that cell blank (null), never zero.
 * @param {{ variables: string[], rows: Record<string, { n: string, v: (number | null)[] }> }[]} files
 */
export function mergeValueFiles(files) {
  if (!files.length) throw new Error('No files to merge.')
  const variables = files[0].variables
  const rows = {}
  for (const file of files) {
    const at = new Map(file.variables.map((id, i) => [id, i]))
    for (const [geoid, row] of Object.entries(file.rows)) {
      rows[geoid] = { n: row.n, v: variables.map((id) => (at.has(id) ? (row.v[at.get(id)] ?? null) : null)) }
    }
  }
  return { variables, rows }
}

/** The states a state-level map can draw: those the build fetched state figures for, in name order. */
export function statesWithFigures(built) {
  return Object.keys(built)
    .filter((f) => built[f].levels.includes('state'))
    .sort((a, b) => built[a].name.localeCompare(built[b].name))
}
