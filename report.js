// The report builder page: pick many measures at once (click, ctrl-click, shift-click) and get one table for
// up to three places, with margins of error, boundaries and sources, as CSV, Excel or print. The values come
// from the compare page's code. The address (?p=GEOID,GEOID&m=measure,measure) makes a report shareable.
import { esc } from './lib/chart.js'
import { hasVintage, levelOf, loadIndex, loadPlaceNames, loadTable, loadTableOrEmpty, stateOf } from './lib/data.js'
import { formatMoe, formatValue } from './lib/format.js'
import { MEASURES } from './lib/measures.js'
import { createPicker } from './lib/pick-ui.js'
import { blankReason, mixNotes, reportCsv, reportGrid, reportNotices, reportValues } from './lib/report.js'
import { toXlsx } from './lib/xlsx.js'

const el = (id) => document.getElementById(id)
const names = new Map() // display name -> GEOID
const byGeoid = new Map() // GEOID -> display name
let built = {}
let pick = [] // the measure ids picked
let result = null // { places, rows }

async function loadPlaces(state) {
  const list = el('places')
  list.replaceChildren()
  for (const [geoid, name] of await loadPlaceNames(state)) {
    names.set(name, geoid)
    byGeoid.set(geoid, name)
  }
  for (const [name] of [...names].filter(([, g]) => stateOf(g) === state).sort((a, b) => a[0].localeCompare(b[0]))) list.append(new Option('', name))
}

// The measures this state has data for, under their group headings.
const picker = createPicker(el('measures'), { onChange: (ids) => { pick = ids; paintCount(); update().catch(fail) } })

function drawList() {
  const have = built[el('state').value]
  const items = []
  for (const m of MEASURES) {
    if (!have?.datasets.includes(m.dataset) || !hasVintage(have, m)) continue
    items.push({ id: m.id, label: m.label, group: m.group ?? 'Census' })
  }
  picker.setItems(items)
  pick = picker.selected()
  paintCount()
}

function paintCount() {
  el('pick-count').textContent = `${pick.length} of ${picker.count()} picked`
}

el('pick-all').addEventListener('click', () => picker.all())
el('pick-none').addEventListener('click', () => picker.clear())

function chosenPlaces() {
  const ids = []
  let unknown = ''
  for (let i = 0; i < 3; i++) {
    const text = el('p' + i).value.trim()
    if (!text) continue
    const geoid = names.get(text)
    if (geoid) {
      if (!ids.includes(geoid)) ids.push(geoid)
    } else unknown = text
  }
  el('status').textContent = unknown ? `“${unknown}” is not a place in the list. Pick one from the suggestions.` : ''
  return ids
}

const shortName = (name) => name.replace(', Massachusetts', '')

async function update() {
  const ids = chosenPlaces()
  const measures = MEASURES.filter((m) => pick.includes(m.id))
  const q = new URLSearchParams()
  if (ids.length) q.set('p', ids.join(','))
  if (measures.length) q.set('m', measures.map((m) => m.id).join(','))
  history.replaceState(null, '', q.size ? `?${q}` : location.pathname)
  for (const id of ['csv', 'xlsx', 'pdf']) el(id).disabled = true
  if (!ids.length || !measures.length) {
    result = null
    el('title').textContent = 'Report'
    el('mix').replaceChildren()
    el('table').textContent = 'Choose at least one place and one measure.'
    el('notices').replaceChildren()
    return
  }
  const places = ids.map((geoid) => ({ geoid, level: levelOf(geoid), name: byGeoid.get(geoid) }))
  const rows = await reportValues(measures, places, (m, level, state) => loadTableOrEmpty(m, level, state))
  result = { places, rows }
  el('title').textContent = places.map((p) => shortName(p.name)).join(' · ')
  el('mix').innerHTML = mixNotes(measures, places).map((n) => `<p>${esc(n)}</p>`).join('')
  drawTable(places, rows)
  el('notices').innerHTML = reportNotices(measures).map((n) => `<p>${esc(n)}</p>`).join('')
  for (const id of ['csv', 'xlsx', 'pdf']) el(id).disabled = false
}

function drawTable(places, rows) {
  const head = places.map((p) => `<th scope="col">${esc(shortName(p.name))}</th>`).join('')
  const body = rows
    .map((r) => {
      const m = r.measure
      const cells = r.values
        .map((v, i) => {
          if (v.est === null) return `<td>no data<span class="blank">${esc(blankReason(m, places[i]))}</span></td>`
          const moe = formatMoe(v.moe, m.unit)
          return `<td>${esc(formatValue(v.est, m.unit))}${moe ? `<span class="moe">${esc(moe)}</span>` : ''}</td>`
        })
        .join('')
      const vintage = (m.vintage ?? 2024) === 2024 ? '' : ` · ${m.vintage} boundaries`
      return `<tr><td>${esc(m.label)}<span class="src">${esc(m.group ?? 'Census')}${esc(vintage)}${m.note ? ' · ' + esc(m.note) : ''}</span></td>${cells}</tr>`
    })
    .join('')
  el('table').innerHTML = `<table><thead><tr><th scope="col">Measure</th>${head}</tr></thead><tbody>${body}</tbody></table>`
}

function download(name, blob) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

const gridNow = () => reportGrid(result.places, result.rows, reportNotices(result.rows.map((r) => r.measure)))
el('csv').addEventListener('click', () => result && download('husky-explorer-report.csv', new Blob([reportCsv(gridNow())], { type: 'text/csv;charset=utf-8' })))
el('xlsx').addEventListener('click', () => result && download('husky-explorer-report.xlsx', new Blob([toXlsx(gridNow(), 'Report')], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })))
el('pdf').addEventListener('click', () => window.print())

function fail(err) {
  el('status').textContent = err.message
}

// A place named in the address that is not in the pick list, such as a block group.
async function ensureName(geoid) {
  if (byGeoid.has(geoid)) return
  const t = await loadTable('acs5-2024', 'B01003', levelOf(geoid), stateOf(geoid))
  if (t.has(geoid)) {
    names.set(t.name(geoid), geoid)
    byGeoid.set(geoid, t.name(geoid))
  }
}

async function start() {
  built = await loadIndex()
  const fips = Object.keys(built).sort((a, b) => built[a].name.localeCompare(built[b].name))
  if (!fips.length) throw new Error('No states have been built yet. Run "Fetch data" first.')
  for (const f of fips) el('state').add(new Option(built[f].name, f))
  const q = new URLSearchParams(location.search)
  const asked = (q.get('p') ?? '').split(',').filter((id) => /^(\d{5}(\d{2}|\d{5}|\d{6}|\d{7})?|\d{2}Z\d{5})$/.test(id)).slice(0, 3)
  const first = asked[0]?.slice(0, 2)
  el('state').value = first && built[first] ? first : built['25'] ? '25' : fips[0]
  await loadPlaces(el('state').value)
  for (const id of asked) await ensureName(id).catch(() => {})
  asked.filter((id) => byGeoid.has(id)).forEach((id, i) => (el('p' + i).value = byGeoid.get(id)))
  drawList()
  picker.select((q.get('m') ?? '').split(','))
  pick = picker.selected()
  paintCount()
  el('state').addEventListener('change', () => loadPlaces(el('state').value).then(drawList).catch(fail))
  for (let i = 0; i < 3; i++) el('p' + i).addEventListener('change', () => update().catch(fail))
  await update()
}

start().catch(fail)
