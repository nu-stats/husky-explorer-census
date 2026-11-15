// The agency report card page: one police department, year by year, from the built FBI tables. Nothing is sent anywhere.
import { esc } from './lib/chart.js'
import { agencyReport, reportCsv } from './lib/agency-report.js'
import { loadIndex, loadTable } from './lib/data.js'
import { normalizeName } from './lib/match.js'
import { indexTable } from './lib/measures.js'

const el = (id) => document.getElementById(id)
const STATUS = { ok: 'Looks complete', check: 'Worth a check', partial: 'Part year', none: 'No NIBRS data' }
const names = new Map() // display name -> GEOID
let built = {}
let nr = null
let cr = null
let current = null

const num = (v, digits = 0) => (v === null || v === undefined ? '' : v.toLocaleString('en-US', { maximumFractionDigits: digits }))

async function tryTable(dataset, table, level, state) {
  try {
    return await loadTable(dataset, table, level, state)
  } catch {
    return null
  }
}

let types = new Map() // agency mode: id -> agency type
let crPlace = null // agency mode: the published city tables, to find a city department's counts by name
let crTown = null

/** All agencies of a state, from the file with every agency type (ORI as the id). */
async function loadAllAgencies(state) {
  try {
    const res = await fetch(`/husky-explorer-census/data/nibrs-agencies/${state}.json`)
    if (!res.ok) return null
    return indexTable(await res.json())
  } catch {
    return null
  }
}

/** The published-counts table and row for a city or town department of agency mode, matched by name; null when none matches. */
function publishedFor(id) {
  if (types.get(id) !== 'City') return null
  const key = normalizeName(nr.name(id))
  for (const t of [crPlace, crTown]) {
    const g = t && Object.keys(t.file.rows).find((x) => normalizeName(t.name(x)) === key)
    if (g) return { table: t, geoid: g }
  }
  return null
}

async function loadAgencies() {
  const state = el('state').value
  const level = el('level').value
  el('agencies').replaceChildren()
  names.clear()
  el('card').hidden = true
  el('empty').hidden = false
  el('status').textContent = ''
  if (level === 'agency') {
    nr = await loadAllAgencies(state)
    cr = null
    types = new Map(nr ? Object.entries(nr.file.rows).map(([id, r]) => [id, r.t]) : [])
    crPlace = await tryTable('cius-2025', 'CR', 'place', state)
    crTown = await tryTable('cius-2025', 'CR', 'cousub', state)
    if (!nr) {
      el('status').textContent = 'The all-agencies file has not been built for this state. Run “Fetch data” (or node src/build-sources.ts --sources nibrs-agencies).'
      return
    }
    const list = Object.entries(nr.file.rows).map(([id, r]) => [`${r.n} (${r.t}${r.c && r.c !== 'NOT SPECIFIED' ? `, ${r.c.toLowerCase()} county` : ''})`, id]).sort((a, b) => a[0].localeCompare(b[0]))
    for (const [label, id] of list) {
      names.set(label, id)
      el('agencies').append(new Option('', label))
    }
    el('status').textContent = `${list.length.toLocaleString()} agencies in ${built[state]?.name ?? 'this state'}.`
    return
  }
  nr = await tryTable('nibrs-reporting', 'NR', level, state)
  cr = await tryTable('cius-2025', 'CR', level, state)
  const source = nr ?? cr
  if (!source) {
    el('status').textContent = 'No FBI crime data was fetched for this state and kind of area. Run “Fetch data” to add it.'
    return
  }
  const ids = new Set([...Object.keys(nr?.file.rows ?? {}), ...Object.keys(cr?.file.rows ?? {})])
  const list = [...ids].map((g) => [(nr?.has(g) ? nr : cr).name(g), g]).sort((a, b) => a[0].localeCompare(b[0]))
  for (const [name, geoid] of list) {
    names.set(name, geoid)
    el('agencies').append(new Option('', name))
  }
  el('status').textContent = `${list.length.toLocaleString()} departments matched to places in ${built[state]?.name ?? 'this state'}.`
}

function show(geoid) {
  let report
  if (el('level').value === 'agency') {
    const kind = types.get(geoid)
    const peerIds = [...types].filter(([, t]) => t === kind).map(([id]) => id)
    const pub = publishedFor(geoid)
    report = agencyReport(nr, pub?.table ?? null, geoid, { peerIds, crGeoid: pub?.geoid ?? null })
    report.note = `Compared with the ${peerIds.length.toLocaleString()} other ${kind} agencies in the state.${pub ? '' : ' No FBI-published city count is matched to this agency (published city tables cover only city and town departments).'}`
  } else report = agencyReport(nr, cr, geoid)
  current = report
  el('empty').hidden = true
  el('card').hidden = false
  el('title').textContent = report.name
  el('peers').textContent = report.note ?? ''
  el('todo').innerHTML = report.todo.map((t) => `<li>${esc(t)}</li>`).join('') || '<li>No incident-based data to review.</li>'
  el('years').querySelector('tbody').innerHTML = report.rows
    .map((r) => `<tr><td>${r.year}</td><td><span class="pill s-${r.status}">${STATUS[r.status]}</span></td><td class="n">${r.months ?? ''}</td><td class="n">${r.monthsWithIncidents ?? ''}</td><td class="n">${num(r.incidents)}</td><td class="n">${num(r.perThousand, 1)}</td><td class="n">${num(r.median, 1)}</td><td class="n">${num(r.published.violent)}</td><td class="n">${num(r.published.property)}</td><td>${r.notes.map(esc).join(' ')}</td></tr>`)
    .join('')
  const notice = (nr ?? cr)?.file.meta.notice
  el('notice').textContent = notice ?? ''
  const url = new URL(location.href)
  url.searchParams.set('g', geoid)
  url.searchParams.set('s', el('state').value)
  url.searchParams.set('l', el('level').value)
  history.replaceState(null, '', url)
}

el('state').addEventListener('change', loadAgencies)
el('level').addEventListener('change', loadAgencies)
el('agency').addEventListener('change', () => {
  const geoid = names.get(el('agency').value.trim())
  if (geoid) show(geoid)
})
el('csv').addEventListener('click', () => {
  if (!current) return
  const url = URL.createObjectURL(new Blob([reportCsv(current)], { type: 'text/csv' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: 'agency-report-card.csv' })
  a.click()
  URL.revokeObjectURL(url)
})

try {
  built = await loadIndex()
} catch (e) {
  el('status').textContent = String(e.message ?? e)
}
const states = Object.entries(built).filter(([, v]) => v.datasets.includes('nibrs-reporting') || v.datasets.includes('cius-2025'))
el('state').replaceChildren(...states.sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([code, v]) => new Option(v.name, code)))
const q = new URLSearchParams(location.search)
if (q.get('s')) el('state').value = q.get('s')
if (q.get('l')) el('level').value = q.get('l')
await loadAgencies()
if (q.get('g') && (nr?.has(q.get('g')) || cr?.has(q.get('g')))) {
  el('agency').value = [...names].find(([, id]) => id === q.get('g'))?.[0] ?? ''
  show(q.get('g'))
}
