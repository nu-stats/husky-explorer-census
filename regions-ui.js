// "Custom regions": pick whole areas by clicking or by drawing a shape, name the set, and get one report for it. Regions
// are kept in this browser and can be saved to a file and opened again. Nothing is sent anywhere.
import { esc } from './lib/chart.js'
import { openText } from './open-file.js'
import { available, loadGeometry, loadTable } from './lib/data.js'
import { formatValue } from './lib/format.js'
import { levelWord } from './lib/match.js'
import { idsInside, readRegionsFile, regionsFile, regionSummary } from './lib/regions.js'
import { toXlsx } from './lib/xlsx.js'

const KEY = 'husky-explorer-regions'

/**
 * @param {{ ol: any, map: any, el: (id: string) => HTMLElement, measures: object[], areaAt: (pixel: number[]) => any,
 *   level: () => string, state: () => string }} hooks
 * @returns {{ busy: () => boolean }} busy: whether a click now means "pick an area" (the map's detail card stays quiet)
 */
export function setupRegions({ ol, map, el, measures, areaAt, level, state }) {
  let regions = []
  try {
    regions = readRegionsFile(localStorage.getItem(KEY) ?? '{}')
  } catch {
    regions = []
  }
  const save = () => {
    try {
      localStorage.setItem(KEY, regionsFile(regions))
    } catch {
      // Storage blocked: the regions last until the page is closed; the file download still works.
    }
  }

  let picking = false
  let drawing = null
  let working = { level: '', state: '', ids: new Set() }
  let last = null // the last report: { region, rows }
  const geometry = new Map() // `${level}/${state}` -> Map id -> GeoJSON feature

  const source = new ol.source.Vector()
  map.addLayer(
    new ol.layer.Vector({
      source,
      style: new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#c8102e', width: 2.5 }), fill: new ol.style.Fill({ color: 'rgba(200,16,46,0.22)' }) }),
      zIndex: 9,
    }),
  )

  const say = (text) => (el('region-status').textContent = text)

  async function shapes(lv, st) {
    const key = `${lv}/${st}`
    if (!geometry.has(key)) {
      const file = await loadGeometry(lv, st)
      geometry.set(key, new Map(file.features.map((f) => [f.id ?? f.properties.id, f])))
    }
    return geometry.get(key)
  }

  async function redraw() {
    source.clear()
    const all = await shapes(working.level, working.state)
    const features = [...working.ids].map((id) => all.get(id)).filter(Boolean)
    source.addFeatures(new ol.format.GeoJSON().readFeatures({ type: 'FeatureCollection', features }, { featureProjection: 'EPSG:3857' }))
    el('region-selection').textContent = working.ids.size ? `${working.ids.size} ${levelWord(working.level)} picked.` : 'Nothing picked yet.'
  }

  // The selection belongs to one level in one state: a change of either starts over.
  function sync() {
    if (working.ids.size && (working.level !== level() || working.state !== state())) {
      working = { level: level(), state: state(), ids: new Set() }
      redraw()
      say('The map changed level or state, so the picked areas were cleared.')
    }
    if (!working.ids.size) working = { level: level(), state: state(), ids: new Set() }
  }

  function setPicking(on) {
    picking = on
    el('region-pick').textContent = on ? 'Click areas on the map… (click again to stop)' : 'Pick areas by clicking'
    map.getTargetElement().style.cursor = on ? 'crosshair' : ''
  }

  el('region-pick').addEventListener('click', () => {
    stopDrawing()
    setPicking(!picking)
    sync()
  })

  map.on('singleclick', (evt) => {
    if (!picking) return
    sync()
    const f = areaAt(evt.pixel)
    if (!f) return
    const id = f.getId()
    if (working.ids.has(id)) working.ids.delete(id)
    else working.ids.add(id)
    redraw()
  })

  function stopDrawing() {
    if (drawing) {
      map.removeInteraction(drawing)
      drawing = null
    }
    el('region-draw').textContent = 'Draw a shape to pick areas'
  }

  el('region-draw').addEventListener('click', () => {
    setPicking(false)
    if (drawing) return stopDrawing()
    sync()
    drawing = new ol.interaction.Draw({ source: new ol.source.Vector(), type: 'Polygon' })
    el('region-draw').textContent = 'Draw on the map… (click here to cancel)'
    drawing.on('drawend', async (evt) => {
      const ring = evt.feature.getGeometry().getCoordinates()[0].map((c) => ol.proj.toLonLat(c))
      stopDrawing()
      const all = await shapes(working.level, working.state)
      const found = idsInside([...all.values()], ring)
      for (const id of found) working.ids.add(id)
      await redraw()
      say(`${found.length} ${levelWord(working.level)} have their center inside the shape and were added.`)
    })
    map.addInteraction(drawing)
  })

  el('region-clear').addEventListener('click', () => {
    working.ids.clear()
    redraw()
    say('')
  })

  el('region-save').addEventListener('click', () => {
    if (!working.ids.size) return say('Pick some areas first.')
    const name = el('region-name').value.trim() || `Region ${regions.length + 1}`
    regions = [...regions.filter((r) => r.name !== name), { name, level: working.level, state: working.state, ids: [...working.ids] }]
    save()
    el('region-name').value = ''
    list()
    say(`Saved “${name}”.`)
  })

  function list() {
    const ul = el('region-list')
    ul.replaceChildren()
    for (const r of regions) {
      const li = document.createElement('li')
      li.innerHTML = `<strong>${esc(r.name)}</strong> <span class="note">${r.ids.length} ${esc(levelWord(r.level))}</span> `
      for (const [label, fn] of [
        ['Show', () => show(r)],
        ['Report', () => report(r)],
        ['Delete', () => {
          regions = regions.filter((x) => x !== r)
          save()
          list()
        }],
      ]) {
        const b = Object.assign(document.createElement('button'), { type: 'button', className: 'link', textContent: label })
        b.addEventListener('click', () => fn().catch?.((e) => say(e.message)) ?? undefined)
        li.append(b, ' ')
      }
      ul.append(li)
    }
  }

  // Showing a region puts its areas on the map in the level and state it was made in.
  async function show(r) {
    if (r.state !== state()) return say(`This region is in another state. Choose that state on the map first.`)
    working = { level: r.level, state: r.state, ids: new Set(r.ids) }
    el('level').value = r.level
    el('level').dispatchEvent(new Event('change'))
    await redraw()
    const extent = source.getExtent()
    if (extent && Number.isFinite(extent[0])) map.getView().fit(extent, { padding: [60, 60, 60, 60], maxZoom: 13, duration: 300 })
    say(`Showing “${r.name}”.`)
  }

  async function report(r) {
    const box = el('region-report')
    box.textContent = 'Working…'
    const rows = []
    for (const m of measures) {
      if ((m.vintage ?? 2024) !== 2024 || m.upload) continue
      if (m.levels && !m.levels.includes(r.level)) continue
      if (!(await available(m, r.level, r.state))) continue
      let t
      try {
        t = await loadTable(m.dataset, m.table, r.level, r.state)
      } catch {
        continue
      }
      const s = regionSummary(m, t, r.ids)
      if (s) rows.push({ label: m.label, text: formatValue(s.value, s.unit), value: s.value, missing: s.missing })
    }
    last = { region: r, rows }
    const table = `<table class="census"><tbody>${rows.map((x) => `<tr><th scope="row" class="lbl">${esc(x.label)}</th><td>${esc(x.text)}${x.missing ? ` <span class="note">(${x.missing} areas had no value)</span>` : ''}</td></tr>`).join('')}</tbody></table>`
    box.innerHTML =
      `<h3>${esc(r.name)}</h3><p class="note">${r.ids.length} ${esc(levelWord(r.level))}, added up whole. Counts add; a percent is the summed numerator over the summed denominator. Medians, rates, indexes and modeled health measures cannot be added across areas, so they are left out. Margins of error are not carried through.</p>` +
      table +
      '<p><button type="button" id="region-csv">Download CSV</button> <button type="button" id="region-xlsx">Download Excel</button></p>'
    el('region-csv').addEventListener('click', () => download('csv'))
    el('region-xlsx').addEventListener('click', () => download('xlsx'))
  }

  function grid() {
    const { region, rows } = last
    return [
      [`${region.name}: ${region.ids.length} ${levelWord(region.level)}, state ${region.state}`],
      ['Measure', 'Value'],
      ...rows.map((x) => [x.label, x.value]),
      ['Whole areas added up; margins of error are not carried through. Source: see the Data sources page. This product uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau.'],
    ]
  }

  function download(kind) {
    if (!last) return
    const name = `region-${last.region.name.replace(/[^\w-]+/g, '-')}.${kind}`
    const g = grid()
    const cell = (x) => (/[",\n]/.test(String(x)) ? `"${String(x).replaceAll('"', '""')}"` : String(x))
    const blob = kind === 'csv' ? new Blob([g.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' }) : new Blob([toXlsx(g, 'Region')], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name })
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  el('regions-save-file').addEventListener('click', () => {
    if (!regions.length) return say('No saved regions to put in a file.')
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([regionsFile(regions)], { type: 'application/json' })), download: 'husky-explorer-regions.json' })
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  })

  el('regions-open').addEventListener('change', async (evt) => {
    const f = evt.target.files[0]
    if (!f) return
    try {
      const incoming = readRegionsFile((await openText(f, ['.json'])).text)
      regions = [...regions.filter((r) => !incoming.some((i) => i.name === r.name)), ...incoming]
      save()
      list()
      say(`Opened ${incoming.length} region${incoming.length === 1 ? '' : 's'}.`)
    } catch (err) {
      say(err.message)
    }
    evt.target.value = ''
  })

  list()
  return { busy: () => picking || !!drawing }
}
