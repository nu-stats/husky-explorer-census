// "Places on the map": dot layers that are not census areas (public housing developments, trauma centers).
// Each is one small file under /data/points/, listed in its index.json; the layer loads when its box is ticked.
import { esc } from './lib/chart.js'

// Trauma designations, darkest for the highest level of care.
const LEVEL_COLORS = {
  'Level I': '#7f0000',
  'Level II': '#d7301f',
  'Level III': '#fc8d59',
  'Level IV': '#fdcc8a',
  'Level V': '#fef0d9',
  'Pediatric Level I': '#08519c',
  'Pediatric Level II': '#6baed6',
  Pediatric: '#9ecae1',
  'Other designation': '#969696',
}

/**
 * @param {{ ol: any, map: any, el: (id: string) => HTMLElement }} hooks
 */
export async function setupPoints({ ol, map, el }) {
  const box = el('points-list')
  let layers
  try {
    const res = await fetch('/husky-explorer-census/data/points/index.json')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    layers = (await res.json()).layers
  } catch {
    box.innerHTML = '<p class="note">No point layers yet. Run “Fetch data” to add public housing and trauma centers.</p>'
    return
  }

  const styleFor = {
    'public-housing': (f) => {
      const units = f.get('units') || 0
      return new ol.style.Style({
        image: new ol.style.RegularShape({
          points: 4,
          angle: Math.PI / 4,
          radius: Math.max(4, Math.min(9, 3 + Math.sqrt(units) / 3)),
          fill: new ol.style.Fill({ color: 'rgba(106,61,154,0.8)' }),
          stroke: new ol.style.Stroke({ color: '#fff', width: 1 }),
        }),
      })
    },
    lihtc: (f) =>
      new ol.style.Style({
        image: new ol.style.Circle({
          radius: Math.max(3, Math.min(8, 2 + Math.sqrt(f.get('units') || 0) / 3)),
          fill: new ol.style.Fill({ color: 'rgba(0,128,128,0.75)' }),
          stroke: new ol.style.Stroke({ color: '#fff', width: 1 }),
        }),
      }),
    tri: () =>
      new ol.style.Style({
        image: new ol.style.Circle({ radius: 3, fill: new ol.style.Fill({ color: 'rgba(140,81,10,0.8)' }), stroke: new ol.style.Stroke({ color: '#fff', width: 0.5 }) }),
      }),
    superfund: () =>
      new ol.style.Style({
        image: new ol.style.RegularShape({ points: 3, radius: 8, fill: new ol.style.Fill({ color: '#b30000' }), stroke: new ol.style.Stroke({ color: '#fff', width: 1 }) }),
      }),
    'trauma-centers': (f) =>
      new ol.style.Style({
        image: new ol.style.Circle({
          radius: 6,
          fill: new ol.style.Fill({ color: LEVEL_COLORS[f.get('trauma_level')] ?? '#969696' }),
          stroke: new ol.style.Stroke({ color: '#333', width: 1 }),
        }),
      }),
  }

  const on = new Map() // layer id -> ol layer
  const notices = el('points-notices')
  const showNotices = () => {
    notices.innerHTML = layers
      .filter((l) => on.has(l.id) && on.get(l.id).getVisible())
      .map((l) => `<p class="note">${esc(l.notice)}</p>`)
      .join('')
  }

  for (const info of layers) {
    const label = document.createElement('label')
    label.className = 'check'
    const input = Object.assign(document.createElement('input'), { type: 'checkbox' })
    label.append(input, ` ${info.label} `)
    const count = Object.assign(document.createElement('span'), { className: 'note', textContent: `(${info.count.toLocaleString('en-US')})` })
    label.append(count)
    box.append(label)
    input.addEventListener('change', async () => {
      if (!on.has(info.id) && input.checked) {
        count.textContent = '(loading…)'
        const collection = await (await fetch(`/husky-explorer-census/data/points/${info.file}`)).json()
        const features = new ol.format.GeoJSON().readFeatures(collection, { featureProjection: 'EPSG:3857' })
        features.forEach((f) => f.set('layerId', info.id, true))
        on.set(info.id, new ol.layer.Vector({ source: new ol.source.Vector({ features }), style: styleFor[info.id], zIndex: 5 }))
        map.addLayer(on.get(info.id))
        count.textContent = `(${info.count.toLocaleString('en-US')})`
      }
      on.get(info.id)?.setVisible(input.checked)
      showNotices()
      legend()
    })
  }

  const legendBox = el('points-legend')
  function legend() {
    const rows = []
    if (on.get('public-housing')?.getVisible()) rows.push('<div class="row"><span class="swatch" style="background:rgba(106,61,154,0.8)"></span>Public housing development (larger = more units)</div>')
    if (on.get('lihtc')?.getVisible()) rows.push('<div class="row"><span class="swatch" style="background:rgba(0,128,128,0.75)"></span>Tax-credit housing property (larger = more units)</div>')
    if (on.get('tri')?.getVisible()) rows.push('<div class="row"><span class="swatch" style="background:rgba(140,81,10,0.8)"></span>Toxic release reporter (TRI)</div>')
    if (on.get('superfund')?.getVisible()) rows.push('<div class="row"><span class="swatch" style="background:#b30000"></span>Superfund site (NPL)</div>')
    if (on.get('trauma-centers')?.getVisible()) {
      for (const [level, color] of Object.entries(LEVEL_COLORS)) rows.push(`<div class="row"><span class="swatch" style="background:${color}"></span>Trauma ${esc(level)}</div>`)
    }
    legendBox.innerHTML = rows.join('')
  }

  // A tooltip beside the pointer while it is over a dot.
  const tip = Object.assign(document.createElement('div'), { id: 'point-tip', hidden: true })
  document.body.append(tip)
  const ours = (layer) => [...on.values()].includes(layer)
  map.on('pointermove', (evt) => {
    if (evt.dragging) return
    const f = map.forEachFeatureAtPixel(evt.pixel, (feature) => feature, { layerFilter: ours, hitTolerance: 4 })
    if (!f) {
      tip.hidden = true
      return
    }
    tip.innerHTML = `<strong>${esc(f.get('name'))}</strong><br>${esc(f.get('summary'))}`
    const rect = map.getTargetElement().getBoundingClientRect()
    tip.style.left = `${Math.min(rect.left + evt.pixel[0] + 14, window.innerWidth - 280)}px`
    tip.style.top = `${rect.top + evt.pixel[1] + 14}px`
    tip.hidden = false
  })
}
