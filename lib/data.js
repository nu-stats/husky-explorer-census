// Loading the built files in the browser, once each. Which states have been
// built is listed in data/build/index.json, written by the data build.
import { indexTable } from './measures.js'
import { ALL_STATES, mergeValueFiles, statesWithFigures, US } from './national.js'
import { packed } from './packed.js'
import { SITE } from './site.js'

/** A built data file. A site profile built with gzip stores the large ones as X.json.gz (lib/packed.js); the browser unzips them. */
function fetchData(url) {
  const path = url.slice(url.indexOf('/husky-explorer-census/data/') + 6)
  if (!SITE?.gzip || !packed(path)) return fetch(url)
  return fetch(`${url}.gz`).then((res) => (res.ok ? new Response(res.body.pipeThrough(new DecompressionStream('gzip')), { headers: { 'content-type': 'application/json' } }) : res))
}

export const LEVELS = ['county', 'tract', 'blockgroup', 'place', 'cousub', 'zcta']
export const LEVEL_NAMES = { county: 'county', tract: 'tract', blockgroup: 'block group', place: 'city or place', cousub: 'town or township', zcta: 'ZIP code area', state: 'state', us: 'United States' }

/** Counties have five-digit GEOIDs, cities and places seven, ZIP code areas eight (state, Z, ZIP), towns and townships ten, tracts eleven and block groups twelve. */
export function levelOf(geoid) {
  return geoid === US ? 'us' : geoid.length === 2 ? 'state' : geoid.length === 5 ? 'county' : geoid.length === 7 ? 'place' : geoid.length === 8 ? 'zcta' : geoid.length === 10 ? 'cousub' : geoid.length === 11 ? 'tract' : 'blockgroup'
}

export function stateOf(geoid) {
  return geoid.slice(0, 2)
}

let indexPromise
/** @returns {Promise<Record<string, { name: string, levels: string[], datasets: string[] }>>} */
export function loadIndex() {
  indexPromise ??= fetch('/husky-explorer-census/data/index.json').then((r) => {
    if (!r.ok) throw new Error('No data yet (no index.json). Run "Fetch data" first.')
    return r.json().then((j) => j.states)
  })
  return indexPromise
}

const tables = new Map()

export function loadTable(dataset, table, level, state) {
  const key = `${dataset}/${level}/${state}/${table}`
  if (!tables.has(key)) {
    // All states: every state's state-level row in one table.
    if (state === ALL_STATES && level === 'state') {
      tables.set(
        key,
        loadIndex().then(async (built) => {
          const fips = statesWithFigures(built)
          // Ask for two states first: a source with no state files answers two 404s, not fifty-two.
          const first = await Promise.allSettled(fips.slice(0, 2).map((s) => loadTable(dataset, table, 'state', s)))
          if (!first.some((r) => r.status === 'fulfilled')) throw new Error(`Missing ${key}: no state has this table at the state level.`)
          const got = await Promise.allSettled(fips.map((s) => loadTable(dataset, table, 'state', s)))
          const files = got.filter((r) => r.status === 'fulfilled').map((r) => r.value.file)
          if (!files.length) throw new Error(`Missing ${key}: no state has this table at the state level.`)
          return indexTable(mergeValueFiles(files))
        }),
      )
      return tables.get(key)
    }
    tables.set(
      key,
      fetchData(`/husky-explorer-census/data/${dataset}/${level}/${state}/${table}.json`).then((r) => {
        if (!r.ok) throw new Error(`Missing ${key} (HTTP ${r.status}). Run "Fetch data" first.`)
        return r.json().then(indexTable)
      }),
    )
  }
  return tables.get(key)
}

const catalogs = new Map()

/** The catalog of a dataset: every table with its variables and their labels. */
export function loadCatalog(dataset) {
  if (!catalogs.has(dataset)) {
    catalogs.set(
      dataset,
      fetch(`/husky-explorer-census/data/${dataset}/catalog.json`).then((r) => {
        if (!r.ok) throw new Error(`Missing the ${dataset} catalog (HTTP ${r.status}). Run "Fetch data" first.`)
        return r.json()
      }),
    )
  }
  return catalogs.get(dataset)
}

/** Boundaries for a state: the current ones (2024) or the 2010 or 2000 ones those censuses were counted on. */
export async function loadGeometry(level, state, vintage = 2024) {
  // The states are one national file, whichever state is chosen.
  if (level === 'state') state = 'us'
  const res = await fetchData(`/husky-explorer-census/data/geometry${vintage === 2024 ? '' : '-' + vintage}/${level}/${state}.json`)
  if (!res.ok) throw new Error(`No ${LEVEL_NAMES[level]} boundaries for state ${state} yet (HTTP ${res.status}). Run "Fetch data" first.`)
  return res.json()
}

/** Whether the state's boundaries for the measure's vintage were built (entries from before 2010 existed have the current set only). */
export function hasVintage(built, m) {
  return (built.vintages ?? [2024]).includes(m.vintage ?? 2024)
}

/** Whether a measure has a value file for this level in this state, by what the build recorded. */
export async function available(m, level, state) {
  // The national figure and the all-states map exist for the measures the build fetched at the state level; a missing file means none, and the caller shows no value.
  if (level === 'us' || state === ALL_STATES) {
    if ((level !== 'us' && level !== 'state') || (m.levels && !m.levels.includes('state')) || (m.vintage ?? 2024) !== 2024) return false
    return loadTable(m.dataset, m.table, level, level === 'us' ? US : state).then(() => true, () => false)
  }
  const built = (await loadIndex())[state]
  return !!built && built.datasets.includes(m.dataset) && (!m.levels || m.levels.includes(level)) && hasVintage(built, m)
}

const EMPTY = indexTable({ variables: [], rows: {} })

/** Like loadTable, but an empty table when the measure does not exist for this level or state (no data, never zero). */
export async function loadTableOrEmpty(m, level, state) {
  if (!(await available(m, level, state))) return EMPTY
  // A state's own row is not fetched for every source (the 2020 census was built for smaller areas): no figure, not an error.
  return level === 'state' ? loadTable(m.dataset, m.table, level, state).catch(() => EMPTY) : loadTable(m.dataset, m.table, level, state)
}

/** The named areas of a state a person can pick (counties, towns, places, ZIP areas, tracts; block groups are too many to list): [[geoid, name]]. */
export async function loadPlaceNames(state) {
  const out = []
  // All states: the states themselves are the places.
  for (const level of state === ALL_STATES ? ['state'] : ['county', 'cousub', 'place', 'zcta', 'tract']) {
    // A state may not have been fetched at every level.
    const t = await loadTable('acs5-2024', 'B01003', level, state).catch(() => null)
    if (t) for (const geoid of Object.keys(t.file.rows)) out.push([geoid, t.name(geoid)])
  }
  return out
}
