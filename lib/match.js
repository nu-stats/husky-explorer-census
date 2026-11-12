// The match assistant: works out what a table's rows are (counties, tracts, towns, ZIP code areas…), builds the
// census ID for each row, and says why a row did not match. It never guesses silently: every reading comes with a
// plain sentence, and the person can pick another. Runs in the browser; nothing leaves it.
import { toNumber } from './join.js'

/**
 * The geographic levels, for the reference card: how big, what the ID looks like, and the caution that bites.
 * `example` is a real place.
 */
export const LEVEL_GUIDE = [
  { level: 'state', name: 'State', ids: '2 digits', example: '25 = Massachusetts', size: '52 areas', note: 'The top of the ladder. A state code below 10 loses its zero in a spreadsheet (06 becomes 6).' },
  { level: 'county', name: 'County', ids: '5 digits: state + county', example: '25025 = Suffolk County, MA', size: 'about 3,100 areas', note: 'Connecticut replaced its 8 counties with 9 planning regions in 2022. Louisiana has parishes and Alaska boroughs.' },
  { level: 'cousub', name: 'Town or township', ids: '10 digits: state + county + town', example: '2501501370 = Amherst, MA', size: 'about 36,000 areas', note: 'New England towns and the townships of states such as New York, Pennsylvania and Michigan are county subdivisions, not places.' },
  { level: 'place', name: 'City or place', ids: '7 digits: state + place', example: '2507000 = Boston, MA', size: 'about 32,000 areas', note: 'Incorporated cities and census-designated places. A city can be in a town (and in more than one county); not every part of a state is in a place.' },
  { level: 'zcta', name: 'ZIP code area', ids: '5-digit ZIP code', example: '02138 = part of Cambridge, MA', size: 'about 33,000 areas', note: 'Not the same as a ZIP code: ZIP areas approximate ZIP codes, cross county lines and are not nested in anything. A PO Box ZIP has no area.' },
  { level: 'tract', name: 'Census tract', ids: '11 digits: state + county + tract', example: '25025010100 = tract 101, Suffolk County', size: 'about 85,000 areas, about 4,000 people each', note: 'Redrawn every ten years: a 2010 tract and a 2020 tract with the same number can be different places.' },
  { level: 'blockgroup', name: 'Block group', ids: '12 digits: tract + 1 digit', example: '250250101001', size: 'about 240,000 areas, about 1,500 people each', note: 'The smallest area with survey estimates; the numbers are rough.' },
]

const STATE_NAMES = {
  '01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas', '06': 'California', '08': 'Colorado', '09': 'Connecticut', '10': 'Delaware',
  '11': 'District of Columbia', '12': 'Florida', '13': 'Georgia', '15': 'Hawaii', '16': 'Idaho', '17': 'Illinois', '18': 'Indiana', '19': 'Iowa',
  '20': 'Kansas', '21': 'Kentucky', '22': 'Louisiana', '23': 'Maine', '24': 'Maryland', '25': 'Massachusetts', '26': 'Michigan', '27': 'Minnesota',
  '28': 'Mississippi', '29': 'Missouri', '30': 'Montana', '31': 'Nebraska', '32': 'Nevada', '33': 'New Hampshire', '34': 'New Jersey', '35': 'New Mexico',
  '36': 'New York', '37': 'North Carolina', '38': 'North Dakota', '39': 'Ohio', '40': 'Oklahoma', '41': 'Oregon', '42': 'Pennsylvania', '44': 'Rhode Island',
  '45': 'South Carolina', '46': 'South Dakota', '47': 'Tennessee', '48': 'Texas', '49': 'Utah', '50': 'Vermont', '51': 'Virginia', '53': 'Washington',
  '54': 'West Virginia', '55': 'Wisconsin', '56': 'Wyoming', '72': 'Puerto Rico',
}
const STATE_ABBR = Object.fromEntries(
  Object.entries({
    AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09', DE: '10', DC: '11', FL: '12', GA: '13', HI: '15', ID: '16', IL: '17', IN: '18', IA: '19', KS: '20', KY: '21', LA: '22', ME: '23', MD: '24', MA: '25',
    MI: '26', MN: '27', MS: '28', MO: '29', MT: '30', NE: '31', NV: '32', NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38', OH: '39', OK: '40', OR: '41', PA: '42', RI: '44', SC: '45', SD: '46', TN: '47', TX: '48',
    UT: '49', VT: '50', VA: '51', WA: '53', WV: '54', WI: '55', WY: '56', PR: '72',
  }),
)
const STATE_BY_NAME = Object.fromEntries(Object.entries(STATE_NAMES).map(([fips, name]) => [name.toLowerCase(), fips]))

const pad = (s, n) => String(s).trim().padStart(n, '0')
const LEVEL_WORD = { state: 'states', county: 'counties', cousub: 'towns and townships', place: 'cities and places', zcta: 'ZIP code areas', tract: 'tracts', blockgroup: 'block groups' }
export const levelWord = (level) => LEVEL_WORD[level] ?? level
const LEVEL_ONE = { county: 'county', cousub: 'town or township', place: 'city or place', zcta: 'ZIP code area', tract: 'census tract', blockgroup: 'block group' }

/** A state as it might be typed: FIPS code (6 or 06), postal letters, or the name; null when it is none of them. */
export function toStateFips(raw) {
  const s = String(raw ?? '').trim()
  if (/^\d{1,2}$/.test(s)) return STATE_NAMES[pad(s, 2)] ? pad(s, 2) : null
  return STATE_ABBR[s.toUpperCase()] ?? STATE_BY_NAME[s.toLowerCase()] ?? null
}

/** A tract as people write it: 101.02, 10102 or 010102 (the last two digits are the part after the dot), as 6 digits. */
export function toTract6(raw) {
  const s = String(raw ?? '').trim()
  const dotted = /^(\d{1,4})\.(\d{1,2})$/.exec(s)
  if (dotted) return pad(dotted[1], 4) + dotted[2].padEnd(2, '0')
  if (/^\d{1,6}$/.test(s)) return s.length <= 4 ? pad(s, 4) + '00' : pad(s, 6)
  return null
}

/** A name for comparing ("Suffolk County, MA" and "Suffolk" are the same county; "Amherst town" and "Amherst Town city" the same town). */
export function normalizeName(raw) {
  const first = String(raw ?? '').split(',')[0] ?? ''
  return first
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\bsaint\b/g, 'st')
    .replace(/(\s+(county|parish|borough|census area|municipality|city and borough|town|city|township|village|cdp|plantation))+\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The state a name cell names after a comma ("Suffolk County, MA"), or null. */
function stateInName(raw) {
  const parts = String(raw ?? '').split(',')
  return parts.length > 1 ? toStateFips(parts[parts.length - 1]) : null
}

const ID_RULES = {
  county: { re: /^\d{4,5}$/, size: 5 },
  place: { re: /^\d{6,7}$/, size: 7 },
  cousub: { re: /^\d{9,10}$/, size: 10 },
  tract: { re: /^\d{10,11}$/, size: 11 },
  blockgroup: { re: /^\d{11,12}$/, size: 12 },
}
// Which reading wins a tie with no lists to check against: the one that needs no zero added.
const CANONICAL = { county: 5, place: 7, cousub: 10, tract: 11, blockgroup: 12 }

function idText(raw) {
  let s = String(raw ?? '').trim()
  const us = s.indexOf('US')
  if (us > 0 && /^\d+$/.test(s.slice(0, us))) s = s.slice(us + 2)
  return s
}

/**
 * @typedef {{ ids: Set<string>, names: Map<string, string> }} AreaList  the areas of one level in the chosen state (names by ID)
 * @typedef {{ state: string, lists: Record<string, AreaList | undefined>, old?: Record<string, Set<string> | undefined> }} Context
 *   lists: the areas drawn for the chosen state, by level. old: the 2010 areas (tracts, block groups), to spot a file from the old boundaries.
 *
 * @typedef {{ id: string, kind: 'geoid' | 'parts' | 'names' | 'zip', level: string, columns: number[], score: number, sure: boolean,
 *   say: string, steps: string[], resolve: (row: string[]) => string | null, padded: (row: string[]) => boolean }} Reading
 */

function share(n, total) {
  return total ? n / total : 0
}

/** Score of an ID reading: the share of rows that matched the known areas (or, with none to check, that look like IDs). */
function scoreIds(ids, known, rows) {
  const valid = ids.filter((g) => g !== null)
  const hit = known ? valid.filter((g) => known.has(g)).length : valid.length
  return { valid: share(valid.length, rows), hit: share(hit, rows) }
}

/**
 * Every sensible way to read the table's rows as areas, best first.
 * @param {string[]} headers
 * @param {string[][]} body
 * @param {Context} ctx
 * @returns {Reading[]}
 */
export function readings(headers, body, ctx) {
  const out = []
  const n = body.length
  const lists = ctx?.lists ?? {}
  const state = ctx?.state ?? ''

  // 1. One column of IDs, at each level it could be.
  headers.forEach((h, c) => {
    for (const [level, rule] of Object.entries(ID_RULES)) {
      const resolve = (row) => {
        const s = idText(row[c])
        return rule.re.test(s) ? pad(s, rule.size) : null
      }
      const ids = body.map(resolve)
      const known = lists[level]?.ids
      const { valid, hit } = scoreIds(ids, known, n)
      if (valid < 0.8) continue
      const canon = share(body.filter((r) => idText(r[c]).length === CANONICAL[level]).length, n)
      const named = /geo.?id|fips|^id$|tract|county|place|town|cousub|block/i.test(h) ? 0.05 : 0
      const score = (known ? hit : valid * 0.9) + canon * 0.02 + named
      const padded = body.filter((r) => {
        const s = idText(r[c])
        return rule.re.test(s) && s.length < rule.size
      }).length
      out.push({
        id: `geoid:${c}:${level}`,
        kind: 'geoid',
        level,
        columns: [c],
        score,
        sure: known ? hit >= 0.8 : false,
        say: `Column “${h || c + 1}” looks like ${LEVEL_ONE[level]} IDs (${CANONICAL[level]} digits).` + (padded ? ` ${padded} had lost a leading zero; I put it back.` : ''),
        steps: [`Read column “${h || c + 1}” as ${LEVEL_ONE[level]} IDs${padded ? ` (added a leading zero to ${padded})` : ''}.`],
        resolve,
        padded: (row) => {
          const s = idText(row[c])
          return rule.re.test(s) && s.length < rule.size
        },
      })
    }
  })

  // 2. A ZIP code column: a header that says so (a 5-digit ID could just as well be a county code).
  headers.forEach((h, c) => {
    const named = /zip|postal|zcta/i.test(h)
    const known = lists.zcta?.ids
    if (!state && !named) return
    const zips = body.map((r) => {
      const s = String(r[c] ?? '').trim().split('-')[0] ?? ''
      return /^\d{3,5}$/.test(s) ? pad(s, 5) : null
    })
    const resolve = (row) => {
      const s = String(row[c] ?? '').trim().split('-')[0] ?? ''
      return state && /^\d{3,5}$/.test(s) ? `${state}Z${pad(s, 5)}` : null
    }
    const ids = body.map(resolve)
    const valid = share(zips.filter(Boolean).length, n)
    if (valid < 0.8) return
    const { hit } = scoreIds(ids, known, n)
    if (!named && (!known || hit < 0.5)) return
    out.push({
      id: `zip:${c}`,
      kind: 'zip',
      level: 'zcta',
      columns: [c],
      score: (known ? hit : valid * 0.9) + (named ? 0.1 : 0),
      sure: named && !!known && hit >= 0.8,
      say: `Column “${h || c + 1}” looks like ZIP codes. They are read as ZIP code areas${state ? ` in ${STATE_NAMES[state]}` : ''}, which approximate ZIP codes (a PO Box ZIP has no area).`,
      steps: [`Read column “${h || c + 1}” as ZIP codes, matched to ZIP code areas${state ? ` in ${STATE_NAMES[state]}` : ''}.`],
      resolve,
      padded: (row) => /^\d{3,4}$/.test(String(row[c] ?? '').trim()),
    })
  })

  // 3. IDs in parts: state, county, tract (and block group) in separate columns.
  const find = (re) => headers.findIndex((h) => re.test(h.trim()))
  const sC = find(/^(state|st|stfips|state.?fips|state.?code|statefp)$/i)
  const cC = find(/^(county|cnty|county.?fips|county.?code|countyfp|county.?fp)$/i)
  const tC = find(/^(tract|tract.?code|tractce|census.?tract|tract.?fips)$/i)
  const bC = find(/^(block.?group|blkgrp|bg|blkgrpce|block.?group.?code)$/i)
  if (cC >= 0 && (sC >= 0 || state)) {
    const fixed = /^\d{1,3}$/
    // The finest columns present name the level: a tract column means a tract file (a county reading of it would only
    // match the rows' counties, and look like a good match), and a block group column means block groups.
    const levels = tC >= 0 && bC >= 0 ? [['blockgroup', [sC, cC, tC, bC]]] : tC >= 0 ? [['tract', [sC, cC, tC]]] : [['county', [sC, cC]]]
    for (const [level, cols] of levels) {
      const resolve = (row) => {
        const st = sC >= 0 ? toStateFips(row[sC]) : state || null
        const co = fixed.test(String(row[cC] ?? '').trim()) ? pad(row[cC], 3) : null
        if (!st || !co) return null
        if (level === 'county') return st + co
        const tr = toTract6(row[tC])
        if (!tr) return null
        if (level === 'tract') return st + co + tr
        const bg = /^\d$/.test(String(row[bC] ?? '').trim()) ? String(row[bC]).trim() : null
        return bg ? st + co + tr + bg : null
      }
      const ids = body.map(resolve)
      const known = lists[level]?.ids
      const { valid, hit } = scoreIds(ids, known, n)
      if (valid < 0.8) continue
      const named = cols.filter((x) => x >= 0).map((x) => `“${headers[x] || x + 1}”`)
      out.push({
        id: `parts:${level}`,
        kind: 'parts',
        level,
        columns: cols.filter((x) => x >= 0),
        // The finest level the columns reach is the likelier meaning: a file with a tract column is about tracts, even when all its rows share a county.
        score: (known ? hit : valid * 0.9) + { county: 0.06, tract: 0.16, blockgroup: 0.26 }[level],
        sure: known ? hit >= 0.8 : false,
        say: `Columns ${named.join(' + ')} look like ${LEVEL_ONE[level]} codes in parts. I joined them into one ID${sC < 0 ? ` (no state column, so ${STATE_NAMES[state]}, the state chosen on the map, was used)` : ''}.`,
        steps: [`Joined columns ${named.join(' + ')} into ${LEVEL_ONE[level]} IDs${sC < 0 ? `, using ${STATE_NAMES[state]} as the state` : ''}.`],
        resolve,
        padded: () => false,
      })
    }
  }

  // 4. Names: counties, towns or cities, matched within one state.
  headers.forEach((h, c) => {
    if (!/county|town|city|place|name|municipal|township|parish|borough|location|area/i.test(h)) return
    for (const level of ['county', 'cousub', 'place']) {
      const list = lists[level]
      if (!list) continue
      const byName = new Map()
      for (const [id, nm] of list.names) {
        const key = normalizeName(nm)
        byName.set(key, byName.has(key) ? null : id) // a name used twice in the state is ambiguous: left out
      }
      const resolve = (row) => {
        const st = stateInName(row[c])
        if (st && st !== state) return null
        const id = byName.get(normalizeName(row[c]))
        return id ?? null
      }
      const ids = body.map(resolve)
      const hit = share(ids.filter(Boolean).length, n)
      if (hit < 0.5) continue
      out.push({
        id: `names:${c}:${level}`,
        kind: 'names',
        level,
        columns: [c],
        score: hit * 0.95,
        sure: hit >= 0.8,
        say: `Column “${h || c + 1}” looks like ${LEVEL_ONE[level]} names. I matched them to ${levelWord(level)} in ${STATE_NAMES[state]}, the state chosen on the map; the same name can exist in other states.`,
        steps: [`Matched the names in column “${h || c + 1}” to ${levelWord(level)} in ${STATE_NAMES[state]}.`],
        resolve,
        padded: () => false,
      })
    }
  })

  return out.sort((a, b) => b.score - a.score)
}

/**
 * Applies a reading to the table.
 * @param {string[][]} body
 * @param {Reading} reading
 * @returns {{ rows: Map<string, string[]>, rowOf: (string | null)[], padded: number, duplicates: number, skipped: number }}
 */
export function applyReading(body, reading) {
  const rows = new Map()
  const rowOf = []
  let padded = 0
  let duplicates = 0
  let skipped = 0
  for (const r of body) {
    const g = reading.resolve(r)
    rowOf.push(g)
    if (!g) {
      skipped++
      continue
    }
    if (reading.padded(r)) padded++
    if (rows.has(g)) duplicates++
    rows.set(g, r)
  }
  return { rows, rowOf, padded, duplicates, skipped }
}

/**
 * Why rows did not match the areas on the map, with counts and examples.
 * @param {string[][]} body
 * @param {(string | null)[]} rowOf the ID built for each row (null when none could be)
 * @param {Reading} reading
 * @param {Context} ctx
 * @returns {{ total: number, matched: number, reasons: { code: string, count: number, text: string, examples: string[] }[], unmatchedRows: { row: number, raw: string, reason: string }[] }}
 */
export function explain(body, rowOf, reading, ctx) {
  const known = ctx?.lists?.[reading.level]?.ids
  const old = ctx?.old?.[reading.level]
  const state = ctx?.state ?? ''
  const text = (row) => reading.columns.map((c) => String(row[c] ?? '').trim()).join(' ')
  const buckets = new Map()
  const unmatchedRows = []
  let matched = 0
  const add = (code, textOf, raw, i) => {
    if (!buckets.has(code)) buckets.set(code, { code, count: 0, text: textOf, examples: [] })
    const b = buckets.get(code)
    b.count++
    if (b.examples.length < 3 && raw) b.examples.push(raw)
    unmatchedRows.push({ row: i + 2, raw, reason: b.text })
  }
  body.forEach((row, i) => {
    const g = rowOf[i]
    const raw = text(row)
    if (g === null) return add('unreadable', 'could not be matched: a blank, a wrong length, or a name that is unknown or used twice in this state', raw, i)
    if (!known) {
      matched++
      return
    }
    if (known.has(g)) {
      matched++
      return
    }
    if (reading.level !== 'zcta' && state && !g.startsWith(state)) return add('other-state', `is in another state, not ${STATE_NAMES[state] ?? 'the chosen state'}`, raw, i)
    if (old?.has(g)) return add('old-boundaries', `is a ${LEVEL_ONE[reading.level]} from the 2010 boundaries that was split, merged or renumbered since (the crosswalk, when built, can carry its values across)`, raw, i)
    return add('not-found', `is not a ${LEVEL_ONE[reading.level]} in ${STATE_NAMES[state] ?? 'this state'}'s list (a typo, a retired code, or a different year's boundaries)`, raw, i)
  })
  return { total: body.length, matched, reasons: [...buckets.values()].sort((a, b) => b.count - a.count), unmatchedRows }
}

/** The steps taken, as plain text for a methods note. */
export function recipe(reading, applied, result, fileName) {
  const lines = [`File: ${fileName}`, ...reading.steps]
  if (applied.duplicates) lines.push(`${applied.duplicates} repeated IDs: the last row for each was kept.`)
  lines.push(`${result.matched} of ${result.total} rows matched ${levelWord(reading.level)} on the map.`)
  for (const r of result.reasons) lines.push(`${r.count} ${r.text}.`)
  return lines
}

/** The numeric columns of a table, leaving out the ones used to identify rows. */
export function numericColumns(headers, body, exclude) {
  return headers.map((_, c) => c).filter((c) => !exclude.includes(c) && body.filter((r) => toNumber(r[c]) !== null).length / Math.max(1, body.length) >= 0.8)
}

/** CSV of the rows that did not match, with the reason. */
export function unmatchedCsv(unmatchedRows) {
  const cell = (x) => (/[",\n]/.test(String(x)) ? `"${String(x).replaceAll('"', '""')}"` : String(x))
  return ['Row in your file,What the match used,Why it did not match', ...unmatchedRows.map((u) => [u.row, u.raw, u.reason].map(cell).join(','))].join('\r\n') + '\r\n'
}
