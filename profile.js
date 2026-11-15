// The place profile page: one place, at a glance and table by table. The place is in the address
// (?g=GEOID&t=TABLE) so a profile can be shared.
import { esc } from './lib/chart.js'
import { LEVEL_NAMES, levelOf, loadCatalog, loadIndex, loadTable, loadTableOrEmpty, stateOf } from './lib/data.js'
import { formatMoe, formatValue, moeText, SHOW_MOE } from './lib/format.js'
import { CRIME_WARNING_SHORT } from './lib/crime-notice.js'
import { indexTable, MEASURES, measureValue } from './lib/measures.js'
import { reportingScreen, reportingSentence } from './lib/quality.js'
import { change, changeText, nameKey, tableGrid, tableRows } from './lib/profile.js'
import { mapCsv } from './lib/mapdata.js'
import { createPicker } from './lib/pick-ui.js'
import { toXlsx } from './lib/xlsx.js'
import { US, US_NAME, US_NOTICE } from './lib/national.js'
import { isCleared } from './lib/clearance.js'

const el = (id) => document.getElementById(id)
const AT_A_GLANCE = ['pop2024', 'income', 'poverty', 'unemployment', 'bachelors', 'home-value', 'median-rent', 'renter', 'hispanic', 'foreign-born', 'crime-violent-2025', 'crime-property-2025', 'police-per-1000-2025']
const SOURCES = {
  'acs5-2024': 'American Community Survey 5-year 2020-2024',
  'acs1-2024': 'American Community Survey 1-year 2024 (places of 65,000 or more)',
}
const notices = () => [
  moeText(`Source: U.S. Census Bureau, ${SOURCES[dataset]}. Margins of error at the 90 percent confidence level.`),
  'This product uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau.',
  ...(current?.rows?.some((r) => r.usShare !== undefined) ? [US_NOTICE] : []),
]

// The five-year estimates before the current ones, fetched for states, counties, towns and places.
const EARLIER = 'acs5-2019'
const EARLIER_LEVELS = ['state', 'county', 'cousub', 'place']
const canEarlier = (level, state) => EARLIER_LEVELS.includes(level) && !!built[state]?.datasets.includes(EARLIER)

// The same place in the earlier file. The Bureau recoded some towns in 2020 (Amherst was 01325, now 01370), so a town or city is found by its full name; counties and states by their code.
async function earlierId(level, state, geoid, name) {
  const t = await loadTable(EARLIER, 'B01003', level, state)
  if (level === 'cousub' || level === 'place') {
    const exact = Object.keys(t.file.rows).find((g) => t.name(g) === name)
    if (exact) return exact
    const key = nameKey(name)
    return Object.keys(t.file.rows).find((g) => nameKey(t.name(g)) === key) ?? null
  }
  return t.has(geoid) ? geoid : null
}

// A value table, or an empty one when its file was not fetched (the 1-year estimates exist only for bigger areas).
async function safeTable(m, level, state) {
  try {
    return await loadTableOrEmpty(m, level, state)
  } catch {
    return indexTable({ variables: [], rows: {} })
  }
}

let built = {}
let dataset = 'acs5-2024' // or the 1-year estimates, for a place big enough to have them
const names = new Map() // display name -> GEOID
let current = null // { geoid, name, parts: the picked tables with rows }
const picker = createPicker(el('table-list'), { onChange: () => current && drawTable().catch(fail) })

async function loadPlaces() {
  const list = el('places')
  list.replaceChildren()
  names.clear()
  const level = el('level').value
  const state = el('state').value
  if (!built[state]?.levels.includes(level)) {
    el('status').textContent = `${LEVEL_NAMES[level][0].toUpperCase() + LEVEL_NAMES[level].slice(1)} areas have not been fetched for ${built[state]?.name ?? 'this state'}. Run “Fetch data” to add them.`
    return
  }
  el('status').textContent = ''
  const t = await loadTable('acs5-2024', 'B01003', level, state)
  const all = Object.keys(t.file.rows).map((g) => [t.name(g), g])
  for (const [name, geoid] of all.sort((a, b) => a[0].localeCompare(b[0]))) {
    names.set(name, geoid)
    list.append(new Option('', name))
  }
}

// Under the tiles, where crime shows: how much this department sent the FBI compared with the typical place in the state, and the
// cautions. Crime numbers without that are easy to misread (a department that sent little shows little crime).
async function reportingNote(level, state, geoid, crimeShown) {
  const box = el('reporting-note')
  // A copy without the FBI's reporting file (a site profile, or a held-back source) shows no note and asks for nothing.
  if (!isCleared('nibrs-reporting')) {
    box.hidden = true
    return
  }
  let text = reportingSentence(null, null, null, 2025)
  let known = false
  try {
    const t = await loadTable('nibrs-reporting', 'NR', level, state)
    const here = t.cell(geoid, 'IPK_2025')
    const peers = Object.keys(t.file.rows).map((g) => t.cell(g, 'IPK_2025'))
    known = here !== null
    text = reportingSentence(here, t.cell(geoid, 'MON_2025'), reportingScreen(here, peers), 2025)
  } catch {
    // No incident-based file for this level or state: the sentence says there is no figure.
  }
  // Shown when the place has crime numbers, or when it has a reporting figure (a place with a figure and no crime tile is the case it matters most).
  box.hidden = !(crimeShown || known)
  if (box.hidden) return
  box.replaceChildren(document.createTextNode(`${text} ${CRIME_WARNING_SHORT} `), Object.assign(document.createElement('a'), { href: '/husky-explorer-census/crime-data.html', textContent: 'Using crime data: the cautions and the research.' }))
}

async function show(geoid) {
  const level = levelOf(geoid)
  const state = stateOf(geoid)
  const base = await loadTable('acs5-2024', 'B01003', level, state)
  if (!base.has(geoid)) {
    el('status').textContent = 'That place is not in the fetched data.'
    return
  }
  const name = base.name(geoid)
  // The 1-year estimates, for places of 65,000 or more.
  let one = false
  if (built[state]?.datasets.includes('acs1-2024')) {
    try {
      one = (await loadTable('acs1-2024', 'B01003', level, state)).has(geoid)
    } catch {
      // None published for this kind of area in this state.
    }
  }
  el('oneyear-box').hidden = !one
  dataset = one && el('oneyear').checked ? 'acs1-2024' : 'acs5-2024'
  el('source').textContent = SHOW_MOE
    ? `Source: U.S. Census Bureau, ${SOURCES[dataset]}. Margins of error are at the 90 percent confidence level. Estimates for small places can have wide margins; a blank means the Bureau published no estimate.`
    : `Source: U.S. Census Bureau, ${SOURCES[dataset]}. A blank means the Bureau published no estimate.`
  // A town, tract or block group sits inside one county, which gives the numbers a yardstick.
  const county = level === 'place' || level === 'county' || level === 'zcta' ? null : geoid.slice(0, 5)
  const countyName = county ? (await loadTable('acs5-2024', 'B01003', 'county', state)).name(county) : null
  el('empty').hidden = true
  el('profile').hidden = false
  el('title').textContent = name
  el('sub').textContent = `${LEVEL_NAMES[level][0].toUpperCase() + LEVEL_NAMES[level].slice(1)} · GEOID ${geoid}`
  el('compare-link').href = `/husky-explorer-census/compare.html?p=${geoid}`

  // The state is a second yardstick, where its numbers have been fetched.
  const stateName = built[state]?.name ?? null
  const stateHas = level !== 'state' && built[state]?.levels.includes('state')

  // The five years before (2015–2019), for the places whose boundaries held across the 2020 redraw.
  const canCompare = canEarlier(level, state) && dataset === 'acs5-2024'
  el('earlier-box').hidden = !canCompare
  const earlierOn = canCompare && el('earlier').checked

  // At a glance
  const tiles = []
  let shownUs = false
  for (const id of AT_A_GLANCE) {
    const base5 = MEASURES.find((x) => x.id === id)
    // Only the ACS measures switch between the 5-year and 1-year files; crime, policing and the rest keep their own source.
    const m = base5 && { ...base5, dataset: base5.dataset === 'acs5-2024' ? dataset : base5.dataset }
    if (!m || (m.levels && !m.levels.includes(level))) continue
    const here = measureValue(m, await safeTable(m, level, state), geoid)
    if (here.est === null) continue
    const there = county && (!m.levels || m.levels.includes('county')) ? measureValue(m, await safeTable(m, 'county', state), county) : null
    const across = stateHas && (!m.levels || m.levels.includes('state')) ? measureValue(m, await safeTable(m, 'state', state), state) : null
    // The national figure, where the source has one (a source built for counties has none: no line, never zero).
    const nation = (!m.levels || m.levels.includes('state')) ? measureValue(m, await safeTable(m, 'us', US), US) : null
    if (nation && nation.est !== null) shownUs = true
    const moe = formatMoe(here.moe, m.unit)
    let then = ''
    if (earlierOn) {
      const old = { ...m, dataset: EARLIER }
      try {
        const was = measureValue(old, await loadTableOrEmpty(old, level, state), await earlierId(level, state, geoid, name))
        const c = change(here, was)
        if (c) then = `<div class="tile-ref">2015–2019: ${esc(formatValue(was.est, m.unit))} · ${esc(changeText(c, m.unit))}</div>`
      } catch {
        // The earlier estimates of this table are not fetched yet: no line.
      }
    }
    tiles.push(
      `<div class="tile"><div class="tile-label">${esc(dataset === 'acs1-2024' ? m.label.replace('ACS 2020–24', 'ACS 2024, 1-year') : m.label)}</div><div class="tile-value">${esc(formatValue(here.est, m.unit))}</div>` +
        (moe ? `<div class="moe">${esc(moe)}</div>` : '') +
        then +
        (there && there.est !== null ? `<div class="tile-ref">${esc(countyName.split(',')[0])}: ${esc(formatValue(there.est, m.unit))}</div>` : '') +
        (across && across.est !== null ? `<div class="tile-ref">${esc(stateName)}: ${esc(formatValue(across.est, m.unit))}</div>` : '') +
        (nation && nation.est !== null && level !== 'us' ? `<div class="tile-ref">${US_NAME}: ${esc(formatValue(nation.est, m.unit))}</div>` : '') +
        '</div>',
    )
  }
  el('tiles').innerHTML = (tiles.join('') || '<p class="note">No at-a-glance numbers are available for this place.</p>') + (shownUs ? `<p class="note us-note">${esc(US_NOTICE)}</p>` : '')
  await reportingNote(level, state, geoid, tiles.some((t) => /reported to police/.test(t)))
  current = { geoid, name }
  await drawTable()
}

const pickedIds = () => picker.selected()

// One table for the place as a block of html with its rows: the estimates, margins of error, shares, and the state's and the earlier years' columns where asked for.
async function oneTable(table, geoid, name, level, state) {
  let values
  try {
    values = await loadTable(dataset, table.id, level, state)
  } catch {
    return { table, html: `<p class="note">${esc(table.concept)} (${esc(table.id)}) was not published, or has not been fetched, for this kind of area.</p>`, rows: null }
  }
  const rows = tableRows(table, values, geoid)
  // The same table for the state, for a column of its percentages beside the place's.
  let stateShares = null
  if (level !== 'state' && built[state]?.levels.includes('state')) {
    try {
      const sv = await loadTable(dataset, table.id, 'state', state)
      stateShares = tableRows(table, sv, state).map((r) => r.share)
    } catch {
      // Not fetched for the state: no column.
    }
  }
  if (stateShares) rows.forEach((r, i) => (r.stateShare = stateShares[i] ?? null))
  // The five years before, when asked for: the same lines, matched by variable.
  let earlier = null
  if (el('earlier').checked && canEarlier(level, state) && dataset === 'acs5-2024') {
    try {
      const ev = await loadTable(EARLIER, table.id, level, state)
      earlier = tableRows(table, ev, await earlierId(level, state, geoid, name))
    } catch {
      // Not fetched for this table: no column.
    }
  }
  if (earlier) {
    const byId = new Map(earlier.map((r) => [r.id, r.est]))
    for (const r of rows) r.before = byId.get(r.id) ?? null
  }
  const hasData = rows.some((r) => r.est !== null)
  const body = rows
    .map((r) => {
      const moe = r.est === null ? '' : formatMoe(r.moe, r.unit)
      const bar = r.share === null ? '' : `<span class="bar" style="width:${Math.min(100, r.share).toFixed(1)}%"></span>`
      return (
        `<tr class="d${Math.min(r.depth, 4)}"><td class="lbl">${esc(r.label)}</td>` +
        `<td>${esc(formatValue(r.est, r.unit))}</td>${SHOW_MOE ? `<td class="moe-cell">${esc(moe)}</td>` : ''}` +
        (earlier ? `<td class="before">${r.before == null ? '' : esc(formatValue(r.before, r.unit))}</td>` : '') +
        `<td class="share">${r.share === null ? '' : r.share.toFixed(1) + '%'}</td>${stateShares ? `<td class="share">${r.stateShare == null ? '' : r.stateShare.toFixed(1) + '%'}</td>` : ''}<td class="barcell">${bar}</td></tr>`
      )
    })
    .join('')
  const html =
    `<h3>${esc(table.concept)} <span class="note">(${esc(table.id)})</span></h3>` +
    (hasData ? '' : '<p class="note">The Bureau published no estimates in this table for this place.</p>') +
    `<table class="census"><thead><tr><th scope="col"></th><th scope="col">Estimate</th>${SHOW_MOE ? '<th scope="col">Margin of error</th>' : ''}${earlier ? '<th scope="col">2015–2019</th>' : ''}<th scope="col">Percent of total</th>${stateShares ? `<th scope="col">${esc(built[state].name)}</th>` : ''}<th></th></tr></thead><tbody>${body}</tbody></table>`
  return { table, html, rows: hasData ? rows : null, title: `${table.id} ${table.concept}` }
}

async function drawTable() {
  const { geoid, name } = current
  const level = levelOf(geoid)
  const state = stateOf(geoid)
  const catalog = await loadCatalog('acs5-2024')
  const chosen = catalog.tables.filter((t) => pickedIds().includes(t.id))
  history.replaceState(null, '', `?g=${geoid}&t=${chosen.map((t) => t.id).join(',')}${el('earlier').checked ? '&c=1' : ''}${el('oneyear').checked ? '&y=1' : ''}`)
  const parts = []
  for (const table of chosen) parts.push(await oneTable(table, geoid, name, level, state))
  current.parts = parts.filter((p) => p.rows)
  el('table-view').innerHTML = parts.map((p) => p.html).join('') || '<p class="note">Pick one or more tables from the list.</p>'
  el('table-csv').disabled = !current.parts.length
  el('table-xlsx').disabled = !current.parts.length
}

// The picked tables as one grid for download: each table's lines with its title, a blank line between, the credits at the end.
function pickedGrid() {
  const grids = current.parts.map((p) => tableGrid(p.title, current.name, p.rows, []))
  return [...grids.flatMap((g, i) => (i ? [[], ...g] : g)), [], ...notices().map((n) => [n])]
}

el('state').addEventListener('change', () => loadPlaces().catch(fail))
el('level').addEventListener('change', () => loadPlaces().catch(fail))
el('place').addEventListener('change', () => {
  const geoid = names.get(el('place').value.trim())
  el('status').textContent = geoid || !el('place').value.trim() ? '' : `“${el('place').value}” is not in the list. Pick one from the suggestions.`
  if (geoid) show(geoid).catch(fail)
})
el('oneyear').addEventListener('change', () => current && show(current.geoid).catch(fail))
el('earlier').addEventListener('change', () => current && show(current.geoid).catch(fail))
el('table-csv').addEventListener('click', () => {
  if (!current?.parts?.length) return
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([mapCsv(pickedGrid())], { type: 'text/csv;charset=utf-8' })), download: `${current.geoid}-${current.parts.map((p) => p.table.id).join('-')}.csv`.slice(0, 120) })
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
})

el('table-xlsx').addEventListener('click', () => {
  if (!current?.parts?.length) return
  const bytes = toXlsx(pickedGrid(), 'Tables')
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })), download: `${current.geoid}-tables.xlsx` })
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
})

function fail(err) {
  el('status').textContent = err.message
}

async function start() {
  built = await loadIndex()
  const fips = Object.keys(built).sort((a, b) => built[a].name.localeCompare(built[b].name))
  for (const f of fips) el('state').add(new Option(built[f].name, f))
  const catalog = await loadCatalog('acs5-2024')
  picker.setItems(catalog.tables.map((t) => ({ id: t.id, label: `${t.concept} (${t.id})` })))
  const q = new URLSearchParams(location.search)
  const g = q.get('g')
  if (g && /^(\d{5}(\d{2}|\d{5}|\d{6}|\d{7})?|\d{2}Z\d{5})$/.test(g)) {
    el('state').value = stateOf(g)
    el('level').value = levelOf(g) === 'blockgroup' ? 'tract' : levelOf(g)
    el('earlier').checked = q.get('c') === '1'
    el('oneyear').checked = q.get('y') === '1'
    picker.select((q.get('t') ?? '').split(','))
    if (!picker.selected().length && catalog.tables[0]) picker.select([catalog.tables[0].id])
    await loadPlaces()
    el('place').value = [...names].find(([, geoid]) => geoid === g)?.[0] ?? ''
    await show(g)
  } else {
    // Towns where a state has them, otherwise cities and places.
    el('state').value = built['25'] ? '25' : fips[0]
    const kinds = ['cousub', 'place', 'zcta', 'county']
    el('level').value = kinds.find((k) => built[el('state').value]?.levels.includes(k)) ?? 'county'
    await loadPlaces()
  }
}

start().catch(fail)
