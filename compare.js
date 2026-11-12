// The compare page: up to three places and a set of measures, side by side as a
// table and a chart, with CSV, PNG and PDF (print) downloads. The state of the
// page lives in the address (?p=GEOID,GEOID&m=measure,measure) so it can be shared.
import { chartSheet, esc, PLACE_COLORS } from './lib/chart.js'
import { compare, compareGrid, toCsv } from './lib/compare.js'
import { toSas } from './lib/sas.js'
import { toSpss } from './lib/spss.js'
import { toStata } from './lib/stata.js'
import { toXlsx } from './lib/xlsx.js'
import { levelOf, loadIndex, loadPlaceNames, loadTable, loadTableOrEmpty, stateOf } from './lib/data.js'
import { formatMoe, formatValue } from './lib/format.js'
import { MEASURES } from './lib/measures.js'
import { tickClick } from './lib/multiselect.js'
import { ALL_STATES, US, US_NAME, US_NOTICE } from './lib/national.js'

const el = (id) => document.getElementById(id)
const NOTICES = [
  'Source: U.S. Census Bureau, American Community Survey 5-year 2020-2024 and 2020 Census. Margins of error at the 90 percent confidence level.',
  'This product uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau.',
]

// The sources of the measures on the page, for the downloads.
function noticesFor(measures, places = result?.places ?? []) {
  return [...NOTICES, ...(places.some((p) => p.geoid === US) ? [US_NOTICE] : []), ...new Set(measures.map((m) => m.credit).filter(Boolean))]
}

const isDefault = (m) => !m.extra

const names = new Map() // display name -> GEOID
const byGeoid = new Map() // GEOID -> display name
let result = null // { places, rows }

// Adds a state's counties and tracts to the pick list (block groups are too many to list).
async function loadPlaces(state) {
  const list = el('places')
  list.replaceChildren()
  for (const [geoid, name] of await loadPlaceNames(state)) addName(geoid, name)
  // The national figure is always one of the choices, beside a place of any state.
  addName(US, US_NAME)
  const here = [...names].filter(([, geoid]) => geoid !== US && (state === ALL_STATES ? geoid.length === 2 : stateOf(geoid) === state)).map(([name]) => name)
  list.append(new Option('', US_NAME))
  for (const name of here.sort()) list.append(new Option('', name))
}

function addName(geoid, name) {
  names.set(name, geoid)
  byGeoid.set(geoid, name)
}

// A place named in the address that is not in the pick list, such as a block group.
async function ensureName(geoid) {
  if (byGeoid.has(geoid)) return
  if (geoid === US) return addName(US, US_NAME)
  const t = await loadTable('acs5-2024', 'B01003', levelOf(geoid), stateOf(geoid))
  if (t.has(geoid)) addName(geoid, t.name(geoid))
}

async function readAddress() {
  const q = new URLSearchParams(location.search)
  const asked = (q.get('p') ?? '').split(',').filter((id) => /^(US|\d{2}|\d{5}(\d{2}|\d{5}|\d{6}|\d{7})?|\d{2}Z\d{5})$/.test(id)).slice(0, 3)
  for (const id of asked) await ensureName(id).catch(() => {})
  const ids = asked.filter((id) => byGeoid.has(id))
  const wanted = q.get('m') ? q.get('m').split(',') : MEASURES.filter(isDefault).map((m) => m.id)
  return { ids, measures: MEASURES.filter((m) => wanted.includes(m.id)) }
}

function writeAddress(ids, measures) {
  const q = new URLSearchParams()
  if (ids.length) q.set('p', ids.join(','))
  const usual = MEASURES.filter(isDefault)
  if (measures.length !== usual.length || !measures.every((m) => usual.includes(m))) q.set('m', measures.map((m) => m.id).join(','))
  history.replaceState(null, '', q.size ? `?${q}` : location.pathname)
}

function chosenMeasures() {
  return MEASURES.filter((m) => el('m-' + m.id).checked)
}

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

async function update() {
  const ids = chosenPlaces()
  const measures = chosenMeasures()
  writeAddress(ids, measures)
  const places = ids.map((geoid) => ({ geoid, level: levelOf(geoid), name: byGeoid.get(geoid) }))
  if (places.length < 1 || !measures.length) {
    result = null
    el('title').textContent = 'Comparison'
    el('table').textContent = 'Choose at least one place and one measure.'
    el('chart').replaceChildren()
    toggleDownloads(false)
    return
  }
  const rows = await compare(measures, places, (m, level, state) => loadTableOrEmpty(m, level, state))
  result = { places, rows }
  el('title').textContent = places.map((p) => shortName(p.name)).join(' · ')
  drawTable(places, rows)
  el('chart').innerHTML = chartSheet(places, rows)
  toggleDownloads(true)
}

function shortName(name) {
  return name.replace(', Massachusetts', '')
}

function toggleDownloads(on) {
  for (const id of ['csv', 'sas', 'png', 'pdf']) el(id).disabled = !on
}

function drawTable(places, rows) {
  const head = places
    .map((p, i) => `<th scope="col"><span class="dot" style="background:${PLACE_COLORS[i]}"></span>${esc(shortName(p.name))}</th>`)
    .join('')
  const showDiff = places.length > 1
  const body = rows
    .map((r) => {
      const cells = r.values
        .map((v, i) => {
          const moe = v.est === null ? '' : formatMoe(v.moe, r.measure.unit)
          // Said in words, so a blank is not read as a zero: this source has no national figure.
          if (v.est === null && places[i].geoid === US) return '<td class="nodata">no national figure</td>'
          return `<td>${esc(formatValue(v.est, r.measure.unit))}${moe ? `<span class="moe">${esc(moe)}</span>` : ''}</td>`
        })
        .join('')
      const diff = r.pairs
        .filter(([, , d]) => d === true)
        .map(([i, j]) => `${esc(shortName(places[i].name))} and ${esc(shortName(places[j].name))}`)
        .join('; ')
      const known = r.pairs.some(([, , d]) => d !== null)
      const diffCell = showDiff ? `<td class="differs">${diff ? 'Differs: ' + diff : known ? 'No difference beyond the margins' : '–'}</td>` : ''
      return `<tr><td>${esc(r.measure.label)}</td>${cells}${diffCell}</tr>`
    })
    .join('')
  el('table').innerHTML = `<table><thead><tr><th scope="col">Measure</th>${head}${showDiff ? '<th scope="col">Statistically different (90%)</th>' : ''}</tr></thead><tbody>${body}</tbody></table>`
}

function download(name, blob) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

function fileName(ext) {
  return `husky-explorer-compare.${ext}`
}

el('csv').addEventListener('click', () => {
  if (!result) return
  download(fileName('csv'), new Blob([toCsv(result.places, result.rows, noticesFor(result.rows.map((r) => r.measure)))], { type: 'text/csv;charset=utf-8' }))
})

el('sas').addEventListener('click', () => {
  if (!result) return
  download(fileName('sas'), new Blob([toSas(result.places, result.rows, noticesFor(result.rows.map((r) => r.measure)))], { type: 'text/plain;charset=utf-8' }))
})

el('xlsx').addEventListener('click', () => {
  if (!result) return
  const grid = compareGrid(result.places, result.rows, noticesFor(result.rows.map((r) => r.measure)))
  download(fileName('xlsx'), new Blob([toXlsx(grid, 'Comparison')], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
})

el('stata').addEventListener('click', () => {
  if (!result) return
  download(fileName('do'), new Blob([toStata(result.places, result.rows, noticesFor(result.rows.map((r) => r.measure)))], { type: 'text/plain;charset=utf-8' }))
})

el('spss').addEventListener('click', () => {
  if (!result) return
  download(fileName('sps'), new Blob([toSpss(result.places, result.rows, noticesFor(result.rows.map((r) => r.measure)))], { type: 'text/plain;charset=utf-8' }))
})

el('png').addEventListener('click', () => {
  if (!result) return
  // The page's text color is not available inside an image, so write real colors and a white page.
  const svg = chartSheet(result.places, result.rows).replaceAll('currentColor', '#1c2430')
  const [, w, h] = /viewBox="0 0 (\d+) (\d+)"/.exec(svg)
  const scale = 2
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = w * scale
    canvas.height = h * scale
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => blob && download(fileName('png'), blob), 'image/png')
  }
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
})

el('pdf').addEventListener('click', () => window.print())

async function start() {
  const box = el('measures')
  for (const m of MEASURES) {
    const label = document.createElement('label')
    label.innerHTML = `<input type="checkbox" id="m-${m.id}" checked> ${esc(m.label)}`
    box.append(label)
  }
  const built = await loadIndex()
  const fips = Object.keys(built).sort((a, b) => built[a].name.localeCompare(built[b].name))
  if (!fips.length) throw new Error('No states have been built yet. Run "Fetch data" first.')
  // Every state at once lists the states themselves as the places to compare.
  el('state').add(new Option('All states', ALL_STATES))
  for (const f of fips) el('state').add(new Option(built[f].name, f))
  const asked = new URLSearchParams(location.search).get('p')?.split(',')[0] ?? ''
  const first = asked.slice(0, 2) // the state of the first place; "US" is no state, so the usual one is shown
  const state = first && built[first] ? first : built['25'] ? '25' : fips[0]
  el('state').value = state
  await loadPlaces(state)
  el('state').addEventListener('change', () => loadPlaces(el('state').value).catch(fail))
  const { ids, measures } = await readAddress()
  ids.forEach((id, i) => (el('p' + i).value = byGeoid.get(id)))
  for (const m of MEASURES) el('m-' + m.id).checked = measures.includes(m)
  for (let i = 0; i < 3; i++) el('p' + i).addEventListener('change', () => update().catch(fail))
  // Shift-click on a tick box sets every box from the last click to this one the same way (the usual click and ctrl-click still tick one).
  let anchor = null
  box.addEventListener('click', (e) => {
    const input = e.target.closest('input[type="checkbox"]')
    if (!input) return
    const id = input.id.slice(2)
    const order = MEASURES.map((m) => m.id)
    const next = tickClick({ ticked: chosenMeasures().map((m) => m.id), anchor }, order, id, input.checked, e.shiftKey)
    anchor = next.anchor
    for (const m of MEASURES) el('m-' + m.id).checked = next.ticked.includes(m.id)
  })
  box.addEventListener('change', () => update().catch(fail))
  await update()
}

function fail(err) {
  el('status').textContent = err.message
}

start().catch(fail)

window.huskyCompare = { update, get result() { return result } }
