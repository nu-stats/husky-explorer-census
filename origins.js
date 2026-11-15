// Where people come from: countries of birth for a county or state, and the
// national refugee table. Everything is read from the files the build wrote.
import { loadIndex, loadTable } from './lib/data.js'
import { formatMoe, formatValue, SHOW_MOE } from './lib/format.js'
import { SITE } from './lib/site.js'
import { countryColumns, topOrigins } from './lib/origins.js'

const el = (id) => document.getElementById(id)
const make = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props)
  e.append(...kids)
  return e
}
const count = (n) => formatValue(n, 'count')

let columns = null
let built = {}

async function loadColumns() {
  const res = await fetch('/husky-explorer-census/data/acs5-2024/catalog.json')
  if (!res.ok) throw new Error('No catalog yet. Run "Fetch data" first.')
  const table = (await res.json()).tables.find((t) => t.id === 'B05006')
  if (!table) throw new Error('The catalog has no table B05006. Run "Fetch data" again to add it.')
  return countryColumns(table.variables)
}

function cell(text, className) {
  return make('td', { textContent: text, className: className ?? '' })
}

function table(head, rows) {
  const t = make('table')
  t.append(make('thead', {}, make('tr', {}, ...head.map((h, i) => make('th', { scope: 'col', textContent: h, style: i === 0 ? 'text-align:left' : '' })))))
  t.append(make('tbody', {}, ...rows))
  return t
}

async function showBorn() {
  const state = el('state').value
  const county = el('county').value
  const t = await loadTable('acs5-2024', 'B05006', 'county', state)
  const { total, rows } = topOrigins(columns, [t], county ? [county] : null, 15)
  const place = county ? t.name(county) : built[state].name
  el('title').textContent = `Countries of birth: ${place}`
  const widest = rows[0]?.est ?? 1
  const body = rows.map((r) => {
    const bar = make('span', { className: 'bar' })
    bar.style.width = `${Math.max(2, Math.round((100 * r.est) / widest))}%`
    return make(
      'tr',
      {},
      make('td', {}, r.name, make('span', { className: 'moe', textContent: r.region })),
      cell(count(r.est), ''),
      ...(SHOW_MOE ? [cell(r.moe === null ? '' : formatMoe(r.moe, 'count'), 'moe-cell')] : []),
      cell(r.share === null ? '' : r.share.toFixed(1) + '%'),
      make('td', { className: 'barcell' }, bar),
    )
  })
  const head = table(['Country of birth', 'People', ...(SHOW_MOE ? ['Margin'] : []), 'Share of foreign-born', ''], body)
  const summary = make('p', { textContent: `Foreign-born residents: ${count(total.est)}${total.moe === null ? '' : ' ' + formatMoe(total.moe, 'count')}. The 15 largest countries of birth are shown.` })
  el('born').replaceChildren(summary, head)
}

async function fillCounties() {
  const state = el('state').value
  const t = await loadTable('acs5-2024', 'B05006', 'county', state)
  const counties = Object.keys(t.file.rows).sort((a, b) => t.name(a).localeCompare(t.name(b)))
  el('county').replaceChildren(new Option('All counties (whole state)', ''), ...counties.map((g) => new Option(t.name(g).split(',')[0], g)))
}

async function showRefugees() {
  const res = await fetch('/husky-explorer-census/data/national/us-refugees.json')
  if (!res.ok) {
    el('refugees').textContent = 'No national refugee file yet. Run "Fetch data" to add it.'
    return
  }
  const file = await res.json()
  const known = file.rows.filter((r) => r.iso !== 'UNK')
  const unknown = file.rows.find((r) => r.iso === 'UNK')
  const total = (key) => file.rows.reduce((s, r) => s + r[key], 0)
  el('unhcr-note').textContent = `${file.meta.year}. Refugees ${count(total('refugees'))}, asylum-seekers ${count(total('asylumSeekers'))}, refugees resettled that year ${count(total('resettled'))}.${unknown ? ` Another ${count(unknown.asylumSeekers + unknown.refugees)} have no recorded country of origin and are not listed below.` : ''}`
  const rows = known.slice(0, 15).map((r) => make('tr', {}, cell(r.name), cell(count(r.refugees)), cell(count(r.asylumSeekers)), cell(count(r.resettled))))
  el('refugees').replaceChildren(table(['Country of origin', 'Refugees', 'Asylum-seekers', `Resettled in ${file.meta.year}`], rows))
}

function fail(err) {
  el('status').textContent = err.message
}

async function start() {
  built = await loadIndex()
  columns = await loadColumns()
  const fips = Object.keys(built)
    .filter((f) => built[f].datasets.includes('acs5-2024'))
    .sort((a, b) => built[a].name.localeCompare(built[b].name))
  if (!fips.length) throw new Error('No states have been built yet. Run "Fetch data" first.')
  for (const f of fips) el('state').add(new Option(built[f].name, f))
  el('state').value = built['25'] ? '25' : fips[0]
  await fillCounties()
  await showBorn().catch(fail)
  el('state').addEventListener('change', () => fillCounties().then(showBorn).catch(fail))
  el('county').addEventListener('change', () => showBorn().catch(fail))
  // A hosted copy that does not hold the national refugee file has no such block and does not ask for it.
  if (!SITE || SITE.national.includes('us-refugees.json')) await showRefugees()
}

start().catch(fail)
