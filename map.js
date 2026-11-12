// The Husky Explorer map: a state's counties, tracts and block groups, colored by
// a measure. Geometry and values are static files from the data build; the colors
// are computed here, in the browser, by joining the two on GEOID. A level's
// boundaries are loaded the first time the map needs them.
import { breakLabels, classIndex, classify, clipRange } from './lib/classify.js'
import { setupAsk } from './ask-ui.js'
import { isLoopbackAddress, layerMessage, RECEIVERS, sendToCraft, tableMessage } from './lib/handoff.js'
import { toDta } from './lib/dta.js'
import { toRScript } from './lib/rscript.js'
import { mapCsv, mapGeoJson, mapGrid, mapNotices, mapTable } from './lib/mapdata.js'
import { toXlsx } from './lib/xlsx.js'
import { available, hasVintage, LEVELS, LEVEL_NAMES, loadGeometry, loadIndex, loadTable, loadTableOrEmpty } from './lib/data.js'
import { ALL_STATES, US, US_NAME, US_NOTICE } from './lib/national.js'
import { decimalsFor, formatMoe, formatValue } from './lib/format.js'
import { inUnits, scale } from './lib/temperature.js'
import { indexTable, MEASURES, measureValue } from './lib/measures.js'
import { rampColors } from './lib/ramps.js'
import { createPicker } from './lib/pick-ui.js'
import { setupNotes } from './notes-ui.js'
import { setupPoints } from './points-ui.js'
import { setupRadius } from './radius-ui.js'
import { setupRegions } from './regions-ui.js'
import { setupUpload } from './upload-ui.js'

const ol = window.ol
const NO_DATA = '#d9d9d9'
// Meters per pixel: coarser than TRACT_BELOW shows counties, finer than BLOCKGROUP_BELOW block groups.
const TRACT_BELOW = 250
const BLOCKGROUP_BELOW = 60

const el = (id) => document.getElementById(id)
const choice = { state: '', measure: MEASURES[0].id, level: 'auto', method: 'natural-breaks', count: 5 }
let measure = MEASURES[0]
let builtStates = {}
// The boundary set on the map: 2024 (today's tracts), 2010 or 2000 (the tracts those censuses were counted on).
let vintage = 2024
// Columns of a file the user brought: { measures, tables (by measure id), level }, or null.
let mine = null
let uploadUi = null
let radiusUi = null
let regionsUi = null
let notesUi = null

// The area under a pixel; the circle and the pinned notes drawn on top of the areas are not areas.
const areaAt = (pixel) => map.forEachFeatureAtPixel(pixel, (feature) => feature, { layerFilter: (l) => l.get('area') === true })

const findMeasure = (id) => MEASURES.find((m) => m.id === id) ?? mine?.measures.find((m) => m.id === id)
// The values of a measure at a level; a file's columns exist only at the file's own level.
const tableFor = (m, level, state) =>
  m.upload ? Promise.resolve(indexTable(level === mine.level ? mine.tables.get(m.id) : { variables: [], rows: {} })) : loadTableOrEmpty(m, level, state)

function makeLayer(level) {
  const source = new ol.source.Vector()
  const styles = new Map()
  const width = { state: 1.2, county: 1.2, tract: 0.5, blockgroup: 0.3, place: 0.8, cousub: 0.8, zcta: 0.6 }[level]
  const layer = new ol.layer.Vector({
    source,
    properties: { area: true },
    updateWhileAnimating: true,
    updateWhileInteracting: true,
    style: (feature) => {
      const color = feature.get('color') ?? NO_DATA
      let style = styles.get(color)
      if (!style) {
        style = new ol.style.Style({
          fill: new ol.style.Fill({ color }),
          stroke: new ol.style.Stroke({ color: 'rgba(255,255,255,0.7)', width }),
        })
        styles.set(color, style)
      }
      return style
    },
  })
  return { level, source, layer, classes: null, colors: [], loaded: null }
}

// The state layer is the All states view; it is not one of the choices of the Areas menu.
const MAP_LEVELS = [...LEVELS, 'state']
const levels = Object.fromEntries(MAP_LEVELS.map((level) => [level, makeLayer(level)]))

// A street map under the data, faded and gray so the colors lead. It is the one thing on this page that
// asks another server for anything (OpenStreetMap's tiles, which see the map position), so it has a switch.
const basemap = new ol.layer.Tile({ source: new ol.source.OSM(), className: 'basemap', zIndex: -1 })
const BASEMAP_KEY = 'husky-explorer-basemap'
function setBasemap(on) {
  basemap.setVisible(on)
  for (const l of Object.values(levels)) l.layer.setOpacity(on ? 0.82 : 1)
  el('basemap').checked = on
  try {
    localStorage.setItem(BASEMAP_KEY, on ? 'on' : 'off')
  } catch {
    // Storage can be blocked; the switch still works for this visit.
  }
}

const map = new ol.Map({
  target: 'map',
  layers: [basemap, ...MAP_LEVELS.map((level) => levels[level].layer)],
  view: new ol.View({ center: ol.proj.fromLonLat([-98, 39]), zoom: 4, minZoom: 3, maxZoom: 15 }),
})

// The cards float over the left of the map on a wide screen, so keep the place out from under them.
const fitPadding = (p) => [p, p, p, window.innerWidth > 900 ? p + 350 : p]

function activeLevel() {
  if (choice.state === ALL_STATES) return 'state'
  if (choice.level !== 'auto') return choice.level
  const r = map.getView().getResolution()
  return r < BLOCKGROUP_BELOW && builtStates[choice.state]?.levels.includes('blockgroup')
    ? 'blockgroup'
    : r < TRACT_BELOW
      ? 'tract'
      : 'county'
}

function showLevels() {
  const active = activeLevel()
  for (const l of Object.values(levels)) l.layer.setVisible(l.level === active)
}

// Loads a level's boundaries for the chosen state, once, and colors it.
function ensureLevel(level) {
  const l = levels[level]
  if (!l.loaded) {
    const state = choice.state
    l.loaded = loadGeometry(level, state, vintage)
      .then((collection) => {
        if (state !== choice.state) return
        const features = new ol.format.GeoJSON().readFeatures(collection, { featureProjection: 'EPSG:3857' })
        for (const f of features) f.setId(f.get('id'))
        l.source.addFeatures(features)
        return colorLevel(l)
      })
      .catch((err) => {
        l.loaded = null
        throw err
      })
  }
  return l.loaded
}

// Computes each feature's value, then the classes and colors, for one level.
// A change made while the tables load (another measure, state or number of classes) starts a newer coloring, and an
// older one that finishes later must not paint over it: each level remembers its latest run and a stale one stops.
async function colorLevel(l) {
  const features = l.source.getFeatures()
  if (!features.length) return
  const run = (l.run = (l.run ?? 0) + 1)
  const m = measure
  const table = await tableFor(m, l.level, choice.state)
  // Places are named from the Census table, so every measure calls them the same thing.
  // The 2010 places are not the current ones, so they take the names in their own table.
  const names = vintage === 2024 || m.upload ? await loadTable('acs5-2024', 'B01003', l.level, choice.state) : table
  if (run !== l.run || m !== measure) return
  const values = []
  for (const f of features) {
    const { est, moe } = measureValue(m, table, f.getId())
    f.set('est', est, true)
    f.set('moe', moe, true)
    f.set('label', names.name(f.getId()), true)
    if (est !== null) values.push(est)
  }
  if (!values.length) {
    l.clip = null
    l.classes = null
    l.colors = []
    for (const f of features) f.set('color', NO_DATA, true)
  } else {
    // A few extreme values (a tract that emptied, a new development) would stretch every class,
    // so a measure that asks for it gets its breaks from the middle 96 percent; the extremes
    // still take the end classes and every value stays true on the map.
    l.clip = m.clip && values.length > 50 ? clipRange(values) : null
    const [lo, hi] = l.clip ?? [-Infinity, Infinity]
    l.classes = classify(l.clip ? values.map((v) => Math.min(hi, Math.max(lo, v))) : values, choice.method, choice.count)
    l.colors = rampColors(m.ramp, l.classes.breaks.length)
    for (const f of features) {
      const est = f.get('est')
      f.set('color', est === null ? NO_DATA : l.colors[classIndex(est, l.classes.min, l.classes.breaks)], true)
    }
  }
  l.layer.getSource().changed()
}

// After a change of measure or classes: recolor what is loaded, and the visible level.
let recolorRun = 0
async function recolor() {
  const run = ++recolorRun
  measure = findMeasure(choice.measure) ?? MEASURES[0]
  if ((measure.vintage ?? 2024) !== vintage) {
    // A measure on the other boundary set: swap the shapes (showState recolors).
    vintage = measure.vintage ?? 2024
    return showState(choice.state)
  }
  for (const l of Object.values(levels)) if (l.loaded && l.level !== activeLevel()) await l.loaded.then(() => colorLevel(l))
  await ensureLevel(activeLevel())
  await colorLevel(levels[activeLevel()])
  // A newer change started while this one waited: it draws the map and the legend.
  if (run !== recolorRun) return
  showLevels()
  drawLegend()
}

function drawLegend() {
  const l = levels[activeLevel()]
  const box = el('legend')
  box.replaceChildren()
  const title = document.createElement('div')
  title.className = 'legend-title'
  title.textContent = `${measure.label}, by ${LEVEL_NAMES[l.level]}`
  box.append(title)
  if (l.classes) {
    const decimals = decimalsFor(measure.unit)
    const prefix = measure.unit === 'dollars' ? '$' : ''
    const temperature = measure.unit === 'celsius' // stored in °C, shown in the chosen scale
    const suffix = measure.unit === 'percent' ? '%' : temperature ? ' °' + scale() : ''
    const shownAs = temperature ? (v) => inUnits(v) : (v) => v
    const labels = breakLabels(shownAs(l.classes.min), l.classes.breaks.map(shownAs), decimals, prefix, suffix)
    // How many areas fall in each class, so the legend also shows the shape of the data.
    const counts = new Array(labels.length).fill(0)
    let none = 0
    for (const f of l.source.getFeatures()) {
      const est = f.get('est')
      if (est === null || est === undefined) none++
      else counts[classIndex(est, l.classes.min, l.classes.breaks)]++
    }
    const most = Math.max(1, ...counts, none)
    labels.forEach((text, i) => box.append(legendRow(l.colors[i], text, counts[i], most)))
    box.append(legendRow(NO_DATA, 'No data', none, most))
  } else box.append(legendRow(NO_DATA, 'No data'))
  if (measure.levels && !measure.levels.includes(l.level)) {
    const plural = { county: 'counties', tract: 'tracts', blockgroup: 'block groups', place: 'cities and places', cousub: 'towns and townships', zcta: 'ZIP code areas' }
    const only = measure.levels.filter((x) => plural[x]).map((x) => plural[x]).join(' and ')
    box.append(noteLine(`This source covers ${only} only. Zoom out to see them.`))
  } else if (measure.note) box.append(noteLine(measure.note))
  if (l.clip) {
    const [lo, hi] = l.clip
    box.append(noteLine(`Classes are set from the middle 96 percent of values. Values below ${formatValue(lo, measure.unit)} or above ${formatValue(hi, measure.unit)} are in the end classes.`))
  }
  if (l.classes?.note) {
    const note = document.createElement('div')
    note.className = 'note'
    note.textContent = l.classes.note
    box.append(note)
  }
}

function noteLine(text) {
  const note = document.createElement('div')
  note.className = 'note'
  note.textContent = text
  return note
}

// The list of measures to pick several from, for a report: a plain click shows that measure on the map, ctrl- and shift-clicks
// add more, and the link carries every pick (and the last area clicked) to the report builder.
let reportPlace = null
const measurePicker = createPicker(el('measure-list'), {
  onChange: (ids, last) => {
    // The map shows one measure: the one clicked last, when it is still picked.
    const shown = last && ids.includes(last) ? last : ids[0]
    if (shown && shown !== choice.measure) {
      el('measure').value = shown
      el('measure').dispatchEvent(new Event('change'))
    }
    paintReportLink()
  },
})
function paintReportLink() {
  const ids = measurePicker.selected().filter((id) => !id.startsWith('upload:'))
  const q = new URLSearchParams()
  if (reportPlace) q.set('p', reportPlace)
  if (ids.length) q.set('m', ids.join(','))
  const link = el('map-report')
  link.href = '/husky-explorer-census/report.html' + (q.size ? '?' + q : '')
  link.textContent = ids.length > 1 ? `Build a report from ${ids.length} measures` : 'Build a report from the picked measures'
  el('map-pick-count').textContent = `${measurePicker.selected().length} picked`
}

// Offers the measures this state has data for, the Census tables first and then the other sources.
async function fillMeasures() {
  const select = el('measure')
  select.replaceChildren()
  const groups = new Map()
  for (const m of [...MEASURES, ...(mine?.measures ?? [])]) {
    const built = builtStates[choice.state]
    if (choice.state === ALL_STATES) {
      // Only the measures with a figure for every state (a source built for counties or tracts has none).
      if (!m.upload && !(await available(m, 'state', ALL_STATES))) continue
    } else if (!m.upload && (!built?.datasets.includes(m.dataset) || !hasVintage(built, m))) continue
    const name = m.group ?? 'Census'
    if (!groups.has(name)) {
      const g = document.createElement('optgroup')
      g.label = name
      groups.set(name, g)
    }
    groups.get(name).append(new Option(m.label, m.id))
  }
  for (const g of groups.values()) select.append(g)
  if (![...select.options].some((o) => o.value === choice.measure)) choice.measure = select.options[0]?.value ?? MEASURES[0].id
  select.value = choice.measure
  measurePicker.setItems([...select.options].map((o) => ({ id: o.value, label: o.textContent, group: o.parentElement.label })))
  if (!measurePicker.selected().includes(choice.measure)) measurePicker.select([choice.measure])
  paintReportLink()
}

function legendRow(color, text, count, most) {
  const row = document.createElement('div')
  row.className = 'legend-row'
  const swatch = document.createElement('span')
  swatch.className = 'swatch'
  swatch.style.background = color
  row.append(swatch, document.createTextNode(text))
  if (count !== undefined) {
    const bar = document.createElement('span')
    bar.className = 'lbar'
    const fill = document.createElement('i')
    fill.style.width = `${Math.round((100 * count) / most)}%`
    fill.style.background = color
    bar.append(fill)
    const n = document.createElement('span')
    n.className = 'lcount'
    n.textContent = count.toLocaleString('en-US')
    n.title = `${count.toLocaleString('en-US')} areas`
    row.append(bar, n)
  }
  return row
}

// Shows a state: forget the old one's shapes, load its counties, fit the view.
async function showState(state) {
  choice.state = state
  for (const l of Object.values(levels)) {
    l.source.clear()
    l.loaded = null
    l.classes = null
  }
  await fillMeasures()
  // Cities and towns exist only for states built with them; a choice that is gone falls back to the zoom-based one.
  // All states draws the states only, so every smaller level is off.
  const everyState = state === ALL_STATES
  document.body.classList.toggle('all-states', everyState)
  for (const kind of ['county', 'tract', 'blockgroup', 'place', 'cousub', 'zcta']) {
    // Counties and tracts are built for every state; block groups, towns, places and ZIP areas only where the index says so.
    const has = !everyState && (kind === 'county' || kind === 'tract' || builtStates[state]?.levels.includes(kind))
    el('level').querySelector(`option[value="${kind}"]`).disabled = !has
    if (!has && choice.level === kind) {
      choice.level = 'auto'
      el('level').value = 'auto'
    }
  }
  // All states draws the states; say so where the other levels are greyed out.
  el('level').querySelector('option[value="auto"]').textContent = everyState ? 'States (pick one state for counties, towns, cities, tracts)' : 'Auto (by zoom)'
  el('detail').replaceChildren(...detailPrompt())
  const url = new URL(location.href)
  url.searchParams.set('s', state)
  history.replaceState(null, '', url)
  if (everyState) {
    // The 48 contiguous states and DC; Alaska and Hawaii are a pan away (Alaska's islands cross the 180th meridian, so the full extent would span the globe).
    await ensureLevel('state')
    map.getView().fit(ol.proj.transformExtent([-125, 24, -66, 50], 'EPSG:4326', 'EPSG:3857'), { padding: fitPadding(20), maxZoom: 10, duration: 0 })
  } else {
    await ensureLevel('county')
    const extent = levels.county.source.getExtent()
    map.getView().fit(extent, { padding: fitPadding(20), maxZoom: 10, duration: 0 })
  }
  await recolor()
  await uploadUi?.showReport()
}

function detailPrompt() {
  const h = document.createElement('h2')
  h.textContent = 'Details'
  const p = document.createElement('p')
  p.textContent = 'Click an area to see every measure for it, with margins of error.'
  return [h, p]
}

function valueText(est, moe, unit) {
  const text = formatValue(est, unit)
  const m = est === null ? '' : formatMoe(moe, unit)
  return { text, m }
}

map.on('pointermove', (evt) => {
  if (evt.dragging) return
  const f = areaAt(evt.pixel)
  const box = el('hover')
  if (!f) {
    box.textContent = 'Point at an area to see its value.'
    return
  }
  const { text, m } = valueText(f.get('est'), f.get('moe'), measure.unit)
  const name = document.createElement('strong')
  name.textContent = f.get('label') ?? f.get('name')
  box.replaceChildren(name, document.createElement('br'), document.createTextNode(`${measure.label}: ${text}${m ? ' ' + m : ''}`))
})

map.on('singleclick', async (evt) => {
  const f = areaAt(evt.pixel)
  const box = el('detail')
  // A click that picks the center of a circle, or pins a note, is not a click on an area.
  if (!f || radiusUi?.picking() || notesUi?.placing() || regionsUi?.busy()) return
  const level = activeLevel()
  const head = document.createElement('h2')
  head.textContent = f.get('label') ?? f.get('name')
  const sub = document.createElement('div')
  sub.className = 'note'
  sub.textContent = `GEOID ${f.getId()}`
  const table = document.createElement('table')
  let anyUs = false
  for (const m of [...MEASURES, ...(mine?.measures ?? [])]) {
    // Only the measures on the boundary set being shown: the other set's places are not these.
    if ((m.vintage ?? 2024) !== vintage || (m.upload ? level !== mine.level : !(await available(m, level, choice.state)))) continue
    const t = await tableFor(m, level, choice.state)
    const { est, moe } = measureValue(m, t, f.getId())
    const { text, m: moeText } = valueText(est, moe, m.unit)
    const tr = document.createElement('tr')
    const th = document.createElement('td')
    th.textContent = m.label
    const td = document.createElement('td')
    td.textContent = text
    if (est === null) td.className = 'nodata'
    if (moeText) {
      const s = document.createElement('span')
      s.className = 'moe'
      s.textContent = moeText
      td.append(s)
    }
    tr.append(th, td)
    // The national figure beside it, where the source has one; a blank (never a zero) where it has not.
    if (!m.upload && vintage === 2024) {
      const us = await available(m, 'us', US)
      const ref = document.createElement('div')
      ref.className = 'us-ref'
      if (us) {
        const v = measureValue(m, await tableFor(m, 'us', US), US)
        ref.textContent = `${US_NAME}: ${formatValue(v.est, m.unit)}`
        if (v.est === null) ref.classList.add('nodata')
      } else {
        ref.textContent = `${US_NAME}: no national figure`
        ref.classList.add('nodata')
      }
      td.append(ref)
      anyUs ||= us
    }
    table.append(tr)
  }
  box.replaceChildren(head, sub, table)
  if (anyUs) {
    const note = document.createElement('p')
    note.className = 'note'
    note.textContent = US_NOTICE
    box.append(note)
  }
  // The compare page uses today's places; 2010 tracts and block groups may not exist there.
  if (vintage === 2024 || level === 'county') {
    const link = document.createElement('a')
    link.href = `/husky-explorer-census/compare.html?p=${f.getId()}`
    link.textContent = 'Compare this place with others'
    box.append(link)
  }
  reportPlace = f.getId()
  paintReportLink()
})

let lastLevel = 'county'
function onLevelChange() {
  const now = activeLevel()
  if (now === lastLevel) return
  lastLevel = now
  recolor().catch(fail)
}
map.getView().on('change:resolution', onLevelChange)

for (const key of ['measure', 'level', 'method', 'count']) {
  el(key).addEventListener('change', () => {
    choice[key] = key === 'count' ? Number(el(key).value) : el(key).value
    lastLevel = activeLevel()
    // A measure set from elsewhere (the ask box, a saved stop) becomes the pick, unless it is one of several already picked.
    if (key === 'measure' && !measurePicker.selected().includes(choice.measure)) {
      measurePicker.select([choice.measure])
      paintReportLink()
    }
    recolor().catch(fail)
  })
}
el('state').addEventListener('change', () => {
  showState(el('state').value).catch(fail)
})

function fail(err) {
  el('legend').textContent = err.message
}

// Carries out a confirmed request from the request box.
async function applyRequest(r) {
  if (r.action === 'compare') {
    location.href = `/husky-explorer-census/compare.html?p=${r.counties.join(',')}&m=${r.measureId}`
    return
  }
  const m = MEASURES.find((x) => x.id === r.measureId)
  // A source with one level (such as tracts) is shown at that level; a county named on its own is shown by its neighborhoods when the data allow.
  let level = r.level
  if (level === 'auto' && m.levels?.length === 1) level = m.levels[0]
  else if (level === 'auto' && r.counties.length === 1 && (!m.levels || m.levels.includes('tract'))) level = 'tract'
  choice.measure = m.id
  choice.level = level
  el('state').value = r.state
  el('level').value = level
  lastLevel = activeLevel()
  await showState(r.state)
  const county = r.counties[0] && levels.county.source.getFeatureById(r.counties[0])
  if (county) map.getView().fit(county.getGeometry().getExtent(), { padding: fitPadding(30), maxZoom: 12, duration: 300 })
}

// What a tour stop remembers about the map now, and the way back to it.
function currentView() {
  const v = map.getView()
  const [lon, lat] = ol.proj.toLonLat(v.getCenter())
  return { state: choice.state, measure: choice.measure, level: choice.level, method: choice.method, count: choice.count, center: [lon, lat], zoom: v.getZoom() }
}

// A picture of the map as drawn now (the basemap and the colored areas, composed from the layers' canvases),
// for the printed tour. It waits for the tiles to finish drawing, but not for long. Null if the browser refuses.
async function mapPicture() {
  await new Promise((done) => {
    const timer = setTimeout(done, 8000)
    map.once('rendercomplete', () => {
      clearTimeout(timer)
      done()
    })
    map.render()
  })
  // Draw once more right now, so the canvases hold the current view even if the browser paces frames slowly.
  map.renderSync()
  const [w, h] = map.getSize()
  const out = Object.assign(document.createElement('canvas'), { width: w, height: h })
  const ctx = out.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  for (const canvas of map.getViewport().querySelectorAll('.ol-layers canvas')) {
    if (!canvas.width) continue
    // Each canvas sits in a wrapper that carries the layer's opacity and its class (the basemap's gray filter).
    const style = getComputedStyle(canvas.parentNode)
    ctx.globalAlpha = Number(style.opacity)
    ctx.filter = style.filter === 'none' ? 'none' : style.filter
    const matrix = canvas.style.transform.match(/^matrix\(([^)]*)\)/)
    if (matrix) ctx.setTransform(...matrix[1].split(',').map(Number))
    else ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(canvas, 0, 0)
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  try {
    return out.toDataURL('image/png')
  } catch {
    return null
  }
}

// Puts a saved view back. Returns a remark in plain words when it could not be matched exactly.
async function showView(v) {
  if (v.state !== ALL_STATES && !builtStates[v.state]) return 'That state has not been built on this computer, so the map stays where it is.'
  const remarks = []
  const m = findMeasure(v.measure)
  if (m) choice.measure = m.id
  else remarks.push(v.measure.startsWith('upload:') ? 'This stop used a file of your own that is not open now.' : 'This stop used a measure that is not available here.')
  Object.assign(choice, { level: v.level, method: v.method, count: v.count })
  el('state').value = v.state
  el('level').value = v.level
  el('method').value = v.method
  el('count').value = String(v.count)
  lastLevel = activeLevel()
  await showState(v.state)
  map.getView().setCenter(ol.proj.fromLonLat(v.center))
  map.getView().setZoom(v.zoom)
  return remarks.join(' ')
}

async function countiesOf(state) {
  const t = await loadTable('acs5-2024', 'B01003', 'county', state)
  return Object.keys(t.file.rows).map((geoid) => ({ geoid, name: t.name(geoid) }))
}

async function start() {
  let saved = null
  try {
    saved = localStorage.getItem(BASEMAP_KEY)
  } catch {
    // Storage can be blocked; use the default.
  }
  setBasemap(saved !== 'off')
  el('basemap').addEventListener('change', () => setBasemap(el('basemap').checked))
  builtStates = await loadIndex()
  setupAsk({ measures: MEASURES, built: builtStates, loadCounties: countiesOf, apply: applyRequest })
  // The example buttons put their words in the box and ask; the person still confirms before anything is drawn.
  for (const chip of document.querySelectorAll('.chip')) {
    chip.addEventListener('click', () => {
      el('ask-text').value = chip.dataset.ask
      el('ask-form').requestSubmit()
    })
  }
  regionsUi = setupRegions({ ol, map, el, measures: MEASURES, areaAt, level: () => activeLevel(), state: () => choice.state })
  radiusUi = setupRadius({ ol, map, el, measures: MEASURES, state: () => choice.state, built: () => builtStates })
  setupPoints({ ol, map, el }).catch(() => {})
  notesUi = setupNotes({ ol, map, el, view: currentView, show: showView, picture: mapPicture, basemapOn: () => basemap.getVisible() })
  uploadUi = setupUpload({
    el,
    state: () => choice.state,
    // The areas drawn at a level in the chosen state, for checking what the file matched.
    knownIds: async (level) => {
      await ensureLevel(level)
      return new Set(levels[level].source.getFeatures().map((f) => f.getId()))
    },
    apply: async (loaded) => {
      mine = loaded
      if (!loaded) {
        if (choice.measure.startsWith('upload:')) choice.measure = MEASURES[0].id
      } else {
        // Show the file's first column, at the level the file is about.
        choice.measure = loaded.measures[0].id
        choice.level = loaded.level
        el('level').value = loaded.level
        lastLevel = activeLevel()
      }
      await fillMeasures()
      await recolor()
    },
  })
  const fips = Object.keys(builtStates).sort((a, b) => builtStates[a].name.localeCompare(builtStates[b].name))
  if (!fips.length) throw new Error('No states have been built yet. Run "Fetch data" first.')
  // Every state at once, drawn at the state level, goes first.
  el('state').add(new Option('All states', ALL_STATES))
  for (const f of fips) el('state').add(new Option(builtStates[f].name, f))
  const wanted = new URLSearchParams(location.search).get('s')
  const first = wanted && (wanted === ALL_STATES || builtStates[wanted]) ? wanted : builtStates['25'] ? '25' : fips[0]
  el('state').value = first
  await showState(first)
}

start().catch(fail)

// Downloads of the level on screen: what the map colors, as a table or with the shapes.
function mapValues() {
  const l = levels[activeLevel()]
  const values = new Map()
  for (const f of l.source.getFeatures()) values.set(f.getId(), { name: f.get('label') ?? '', est: f.get('est') ?? null, moe: f.get('moe') ?? null })
  return { l, values }
}

function save(name, blob) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

function downloadName(ext, l) {
  return `husky-explorer-${choice.measure}-${l.level}-${choice.state}.${ext}`.replace(/[^\w.-]+/g, '-')
}

for (const [id, ext] of [['dl-csv', 'csv'], ['dl-xlsx', 'xlsx'], ['dl-geojson', 'geojson']]) {
  document.getElementById(id).addEventListener('click', async () => {
    const { l, values } = mapValues()
    if (!values.size) return
    const notes = mapNotices(measure, LEVEL_NAMES[l.level], choice.state)
    if (ext === 'csv') save(downloadName(ext, l), new Blob([mapCsv(mapGrid(measure, values, notes))], { type: 'text/csv;charset=utf-8' }))
    else if (ext === 'xlsx') save(downloadName(ext, l), new Blob([toXlsx(mapGrid(measure, values, notes), measure.label)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
    else save(downloadName(ext, l), new Blob([JSON.stringify(mapGeoJson(measure, await loadGeometry(l.level, choice.state, vintage), values, notes))], { type: 'application/geo+json' }))
  })
}

// Files for StatCraft and RCraft (no receiving side yet), and the hand-off to the Crafts that have one.
document.getElementById('dl-dta').addEventListener('click', () => {
  const { l, values } = mapValues()
  if (!values.size) return
  const { columns, rows } = mapTable(measure, values)
  save(downloadName('dta', l), new Blob([toDta(columns, rows, `${measure.label}, ${LEVEL_NAMES[l.level]}, state ${choice.state}`.slice(0, 80))], { type: 'application/octet-stream' }))
})

document.getElementById('dl-r').addEventListener('click', () => {
  const { l, values } = mapValues()
  if (!values.size) return
  const { columns, rows } = mapTable(measure, values)
  save(downloadName('R', l), new Blob([toRScript(columns, rows, { title: `${measure.label}, ${LEVEL_NAMES[l.level]}, state ${choice.state}`, notices: mapNotices(measure, LEVEL_NAMES[l.level], choice.state) })], { type: 'text/plain;charset=utf-8' }))
})

const ADDRESSES = 'husky-explorer-craft-addresses'
const savedAddresses = () => {
  try {
    return JSON.parse(localStorage.getItem(ADDRESSES) ?? '{}')
  } catch {
    return {}
  }
}
function showAddress() {
  document.getElementById('send-address').value = savedAddresses()[document.getElementById('send-to').value] ?? ''
}
document.getElementById('send-to').addEventListener('change', showAddress)
showAddress()

document.getElementById('send-go').addEventListener('click', async () => {
  const status = document.getElementById('send-status')
  const { l, values } = mapValues()
  if (!values.size) return void (status.textContent = 'Nothing is drawn to send.')
  const receiver = RECEIVERS.find((r) => r.id === document.getElementById('send-to').value)
  const address = document.getElementById('send-address').value.trim()
  let as = document.getElementById('send-as').value
  if (!receiver.takes.includes(as)) as = receiver.takes[0]
  if (!isLoopbackAddress(address)) return void (status.textContent = 'Paste the address from that Craft’s window: it must start with http://127.0.0.1, http://localhost or http://[::1].')
  try {
    localStorage.setItem(ADDRESSES, JSON.stringify({ ...savedAddresses(), [receiver.id]: address }))
  } catch {
    // Storage blocked: the address is not remembered.
  }
  const notes = mapNotices(measure, LEVEL_NAMES[l.level], choice.state)
  const grid = mapTable(measure, values)
  const fileBase = downloadName('', l).replace(/\.$/, '')
  const message =
    as === 'layer'
      ? layerMessage({ fileName: `${fileBase}.geojson`, name: measure.label, geojson: mapGeoJson(measure, await loadGeometry(l.level, choice.state, vintage), values, notes), source: 'Husky Explorer', notices: notes })
      : tableMessage({ fileName: `${fileBase}.csv`, csv: mapCsv(mapGrid(measure, values, notes)), columns: grid.columns, notices: notes, geography: { level: l.level, state: choice.state } })
  status.textContent = `Opening ${receiver.name}… (waiting up to 20 seconds for it to answer)`
  const result = await sendToCraft({ address, receiver, message })
  if (result === 'sent') status.textContent = `Sent to ${receiver.name}: ${as === 'layer' ? 'shapes with values' : 'a table'}. Nothing was saved to your computer.`
  else if (result === 'blocked') status.textContent = 'The browser blocked the new window. Allow pop-ups for this page and try again.'
  else {
    status.textContent = `${receiver.name} did not answer in 20 seconds (the address may be wrong, or it may not take data from Husky Explorer yet). I saved the file instead: open it in ${receiver.name}.`
    document.getElementById(as === 'layer' ? 'dl-geojson' : 'dl-csv').click()
  }
})

// For checking in a browser console or an automated test.
window.huskyExplorer = { map, levels, choice, recolor, showState }
