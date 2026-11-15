import { SITE } from './site.js'

let pending

/**
 * Whether the built files for a dataset at a level hold the state. On a hosted copy that holds only some of them the build writes
 * data/coverage.json (dataset, then level, then the states with files), so a page can skip a request that would only 404. Without a
 * site profile, or without that file, this says yes and the page asks as it always did.
 * @param {string} dataset
 * @param {string} level
 * @param {string} state
 */
export async function holds(dataset, level, state) {
  if (!SITE) return true
  pending ??= fetch('/husky-explorer-census/data/coverage.json').then((r) => (r.ok ? r.json() : null)).catch(() => null)
  const coverage = await pending
  return !coverage || !!coverage[dataset]?.[level]?.includes(state)
}
