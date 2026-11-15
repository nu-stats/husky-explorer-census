// "Around a point": pick a point on the map and a distance, and get totals for the people inside the
// circle, from the block groups (or tracts) that overlap it, each weighted by the share of its area inside.
import { available, loadGeometry, loadTable } from './lib/data.js'
import { formatValue, SHOW_MOE } from './lib/format.js'
import { circleRing, shareInside, summarize } from './lib/radius.js'

/**
 * @param {{ ol: any, map: any, el: (id: string) => HTMLElement, measures: object[],
 *   state: () => string, built: () => Record<string, any> }} hooks
 * @returns {{ picking: () => boolean }}
 */
export function setupRadius({ ol, map, el, measures, state, built }) {
  let picking = false
  let last = null
  const source = new ol.source.Vector()
  map.addLayer(
    new ol.layer.Vector({
      source,
      style: new ol.style.Style({
        stroke: new ol.style.Stroke({ color: '#c00', width: 2 }),
        fill: new ol.style.Fill({ color: 'rgba(204,0,0,0.08)' }),
      }),
      zIndex: 10,
    }),
  )

  const setPicking = (on) => {
    picking = on
    el('radius-pick').textContent = on ? 'Click the map…' : 'Pick a point on the map'
    map.getTargetElement().style.cursor = on ? 'crosshair' : ''
  }
  el('radius-pick').addEventListener('click', () => setPicking(!picking))
  el('radius-clear').addEventListener('click', () => {
    source.clear()
    last = null
    setPicking(false)
    el('radius-result').replaceChildren()
  })

  map.on('singleclick', async (evt) => {
    if (!picking) return
    setPicking(false)
    const [lon, lat] = ol.proj.toLonLat(evt.coordinate)
    const miles = Number(el('radius-miles').value)
    try {
      await run(lon, lat, miles)
    } catch (err) {
      el('radius-result').textContent = err.message
    }
  })

  async function run(lon, lat, miles) {
    const st = state()
    const level = built()[st]?.levels.includes('blockgroup') ? 'blockgroup' : 'tract'
    const ring = circleRing(lon, lat, miles)
    source.clear()
    source.addFeature(new ol.Feature(new ol.geom.Polygon([ring.concat([ring[0]]).map((p) => ol.proj.fromLonLat(p))])))
    el('radius-result').textContent = 'Working…'
    const shapes = await loadGeometry(level, st)
    const shares = new Map()
    for (const f of shapes.features) {
      const s = shareInside(f.geometry, ring)
      if (s > 0) shares.set(f.id ?? f.properties?.id, s)
    }
    const rows = []
    for (const m of measures) {
      if ((m.vintage ?? 2024) !== 2024 || m.extra || !(await available(m, level, st))) continue
      const r = summarize(m, await loadTable(m.dataset, m.table, level, st), shares)
      if (r) rows.push({ label: m.label, text: formatValue(r.value, r.unit), value: r.value, missing: r.missing })
    }
    last = { lon, lat, miles, level, areas: shares.size, rows }
    show()
  }

  function show() {
    const box = el('radius-result')
    if (!last) return
    const plural = last.level === 'blockgroup' ? 'block groups' : 'tracts'
    const head = Object.assign(document.createElement('p'), {
      textContent: `Within ${last.miles} mile${last.miles === 1 ? '' : 's'} of ${last.lat.toFixed(4)}, ${last.lon.toFixed(4)}: ${last.areas} ${plural} overlap the circle.`,
    })
    const table = document.createElement('table')
    for (const r of last.rows) {
      const tr = document.createElement('tr')
      const a = Object.assign(document.createElement('td'), { textContent: r.label })
      const b = Object.assign(document.createElement('td'), { textContent: r.text + (r.missing ? ` (${r.missing} areas had no value)` : '') })
      tr.append(a, b)
      table.append(tr)
    }
    const note = Object.assign(document.createElement('p'), {
      className: 'note',
      textContent: `Each ${plural.slice(0, -1)} counts in proportion to the share of its land inside the circle, which assumes people are spread evenly within it. Counts are rounded estimates; percents are shared numerator over shared denominator. Medians and modeled health measures cannot be added up, so they are left out.${SHOW_MOE ? ' Margins of error are not carried through.' : ''}`,
    })
    const csv = document.createElement('button')
    csv.type = 'button'
    csv.className = 'link'
    csv.textContent = 'Download as CSV'
    csv.addEventListener('click', download)
    box.replaceChildren(head, table, note, csv)
  }

  function download() {
    const q = (s) => `"${String(s).replace(/"/g, '""')}"`
    const lines = [['measure', 'value', 'center_lat', 'center_lon', 'miles', 'areas', 'area_level'].join(',')]
    for (const r of last.rows) lines.push([q(r.label), r.value, last.lat, last.lon, last.miles, last.areas, last.level].join(','))
    const url = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'text/csv' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: 'around-a-point.csv' })
    a.click()
    URL.revokeObjectURL(url)
  }

  return { picking: () => picking }
}
