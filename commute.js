// Commuting: where the residents of a county work, from the files the commuting build wrote
// (the county measures, and each county's biggest work destinations).
import { loadGeometry, loadIndex, loadTable } from './lib/data.js'
import { formatValue } from './lib/format.js'
import { arcPath, centers, destinationRows, geometryPath, projection, strokeFor } from './lib/commute.js'

const el = (id) => document.getElementById(id)
const make = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props)
  e.append(...kids)
  return e
}
const SVG = 'http://www.w3.org/2000/svg'
const svg = (tag, attrs = {}) => {
  const e = document.createElementNS(SVG, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  return e
}
// Connecticut's counties were replaced by planning regions in 2022; the commuting files still use the old ones.
const OLD_CT = { '09001': 'Fairfield County (old)', '09003': 'Hartford County (old)', '09005': 'Litchfield County (old)', '09007': 'Middlesex County (old)', '09009': 'New Haven County (old)', '09011': 'New London County (old)', '09013': 'Tolland County (old)', '09015': 'Windham County (old)' }
const count = (n) => formatValue(n, 'count')

let built = {}
const flowFiles = new Map()

function loadFlows(state) {
  if (!flowFiles.has(state)) {
    flowFiles.set(
      state,
      fetch(`/husky-explorer-census/data/commuting-2023/flows/${state}.json`).then((r) => {
        if (!r.ok) throw new Error(`No commuting file for this state (HTTP ${r.status}). Run "Fetch data" to build it. Alaska, Michigan and Puerto Rico have no 2023 data.`)
        return r.json()
      }),
    )
  }
  return flowFiles.get(state)
}

async function fillCounties() {
  const state = el('state').value
  const t = await loadTable('commuting-2023', 'CM', 'county', state)
  const ids = Object.keys(t.file.rows).sort((a, b) => t.name(a).localeCompare(t.name(b)))
  el('county').replaceChildren(...ids.map((g) => new Option(t.name(g).split(',')[0], g)))
  const first = state === '25' ? '25025' : ids[0]
  el('county').value = first
}

async function show() {
  el('status').textContent = ''
  const state = el('state').value
  const home = el('county').value
  const [t, flows] = await Promise.all([loadTable('commuting-2023', 'CM', 'county', state), loadFlows(state)])
  const flow = flows.flows[home]
  if (!flow) throw new Error('No commuting flows for this county.')
  const row = t.file.rows[home].v // WRK JOB SAME OUT IN NET
  const place = t.name(home)
  el('title').textContent = `Where residents of ${place} work`
  el('summary').textContent = `${count(row[0])} jobs are held by people who live here. ${count(row[2])} (${(100 - row[3]).toFixed(1)}%) are in the county; ${row[3].toFixed(1)}% are in other counties. The county has ${count(row[1])} jobs, ${row[4].toFixed(1)}% held by people who live elsewhere.`

  // Outlines of every state the flows touch (usually one to three) so the lines sit on a map.
  const states = [...new Set([state, ...flow.to.map(([id]) => id.slice(0, 2))])].filter((s) => built[s]?.levels.includes('county'))
  const geos = await Promise.all(states.map((s) => loadGeometry('county', s).catch(() => ({ features: [] }))))
  const features = geos.flatMap((g) => g.features)
  const where = centers(features)
  const names = new Map(features.map((f) => [f.properties.id, f.properties.name]))
  const nameOf = (id) => {
    const base = names.get(id) ?? OLD_CT[id] ?? `County ${id}`
    const st = built[id.slice(0, 2)]?.name ?? ''
    return id.slice(0, 2) === state || base === st ? base : `${base}, ${st}`
  }

  const rows = destinationRows(flow, home, nameOf)
  const points = [home, ...rows.map((r) => r.id)].map((id) => where.get(id)).filter(Boolean)
  if (points.length) drawMap(features, where, home, rows, points)
  else el('flow-map').replaceChildren()

  const body = rows.map((r) =>
    make('tr', { 'data-id': r.id }, make('td', { textContent: r.stays ? `${r.name} (stays in the county)` : r.name }), make('td', { className: 'num', textContent: count(r.jobs) }), make('td', { className: 'num', textContent: r.share === null ? '' : r.share.toFixed(1) + '%' })),
  )
  const head = make('thead', {}, make('tr', {}, make('th', { scope: 'col', textContent: 'Work county', style: 'text-align:left' }), make('th', { scope: 'col', className: 'num', textContent: 'Jobs' }), make('th', { scope: 'col', className: 'num', textContent: 'Share of residents’ jobs' })))
  el('destinations').replaceChildren(make('table', {}, head, make('tbody', {}, ...body)))
  for (const tr of el('destinations').querySelectorAll('tbody tr')) {
    tr.addEventListener('mouseenter', () => mark(tr.dataset.id, true))
    tr.addEventListener('mouseleave', () => mark(tr.dataset.id, false))
  }
}

const mark = (id, on) => el('flow-map').querySelector(`[data-flow="${id}"]`)?.classList.toggle('on', on)

function drawMap(features, where, home, rows, points) {
  const { project, width, height } = projection(points)
  const map = svg('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'Lines from the home county to the counties its residents work in' })
  for (const f of features) {
    if (!f.geometry) continue
    map.append(svg('path', { d: geometryPath(f.geometry, project), class: f.properties.id === home ? 'home' : 'county' }))
  }
  const from = project(where.get(home) ?? points[0])
  const biggest = Math.max(1, ...rows.filter((r) => !r.stays).map((r) => r.jobs))
  for (const r of rows) {
    const c = where.get(r.id)
    if (r.stays || !c) continue
    map.append(svg('path', { d: arcPath(from, project(c)), class: 'flow', 'data-flow': r.id, 'stroke-width': strokeFor(r.jobs, biggest).toFixed(1) }))
  }
  map.append(svg('circle', { cx: from[0], cy: from[1], r: 6 }))
  for (const r of rows.filter((x) => !x.stays).slice(0, 5)) {
    const c = where.get(r.id)
    if (!c) continue
    const [x, y] = project(c)
    const label = svg('text', { x: x + 8, y: y + 4 })
    label.textContent = r.name.split(',')[0].replace(/ County$/, '')
    map.append(label)
  }
  el('flow-map').replaceChildren(map)
}

const fail = (err) => {
  el('status').textContent = err.message
}

async function start() {
  built = await loadIndex()
  const fips = Object.keys(built)
    .filter((f) => built[f].datasets.includes('commuting-2023'))
    .sort((a, b) => built[a].name.localeCompare(built[b].name))
  if (!fips.length) throw new Error('No commuting data yet. Run "Fetch data" first.')
  for (const f of fips) el('state').add(new Option(built[f].name, f))
  el('state').value = built['25'] && fips.includes('25') ? '25' : fips[0]
  await fillCounties()
  await show().catch(fail)
  el('state').addEventListener('change', () => fillCounties().then(show).catch(fail))
  el('county').addEventListener('change', () => show().catch(fail))
}

start().catch(fail)
