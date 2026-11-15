// "Find where": the panel on the map page. A person sets up to four cutoffs; the areas that meet all of them are
// outlined on the map, listed, and can be downloaded. Nothing is sent anywhere.
import { esc } from './lib/chart.js'
import { available, loadGeometry, loadTable } from './lib/data.js'
import { describeConditions, findAreas, findGrid, OPS } from './lib/findwhere.js'
import { formatValue, moeText } from './lib/format.js'
import { levelWord } from './lib/match.js'
import { mapCsv } from './lib/mapdata.js'
import { toXlsx } from './lib/xlsx.js'

const MAX = 4
const SHOWN = 50
const API_NOTICE = 'This product uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau.'

/**
 * @param {{ ol: any, map: any, el: (id: string) => HTMLElement, measures: object[], level: () => string, state: () => string,
 *   saveRegion: (name: string, level: string, state: string, ids: string[]) => string }} hooks
 */
export function setupFindWhere({ ol, map, el, measures, level, state, saveRegion }) {
  const rows = el('fw-rows')
  let last = null // { conditions, result, level, state }
  const options = new Map() // `${level}/${state}` -> measures that can be used there

  const source = new ol.source.Vector()
  map.addLayer(
    new ol.layer.Vector({
      source,
      style: new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#c8102e', width: 2.5 }), fill: new ol.style.Fill({ color: 'rgba(200,16,46,0.22)' }) }),
      zIndex: 9,
    }),
  )

  const say = (text) => (el('fw-status').textContent = text)

  // Measures with values for this level in this state, from the 2024 boundary set (the one the map is drawn on).
  async function usable() {
    const lv = level()
    const st = state()
    const key = `${lv}/${st}`
    if (!options.has(key)) {
      const ok = []
      for (const m of measures) {
        if ((m.vintage ?? 2024) !== 2024 || m.upload) continue
        if (await available(m, lv, st)) ok.push(m)
      }
      options.set(key, ok)
    }
    return options.get(key)
  }

  async function addRow() {
    if (rows.children.length >= MAX) return say(`Up to ${MAX} cutoffs.`)
    if (!state()) return say('Choose a state on the map first.')
    const list = await usable()
    if (!list.length) return say(`No data has been fetched for ${levelWord(level())} in this state. Run “Fetch data”, or pick another level.`)
    const row = document.createElement('div')
    row.className = 'fw-row'
    const groups = new Map()
    const measure = document.createElement('select')
    measure.setAttribute('aria-label', 'Measure')
    for (const m of list) {
      const g = m.group ?? 'Census'
      if (!groups.has(g)) groups.set(g, Object.assign(document.createElement('optgroup'), { label: g }))
      groups.get(g).append(new Option(m.label, m.id))
    }
    measure.append(...groups.values())
    const op = document.createElement('select')
    op.setAttribute('aria-label', 'Cutoff type')
    for (const [v, label] of Object.entries(OPS)) op.append(new Option(label, v))
    const a = Object.assign(document.createElement('input'), { type: 'number', step: 'any', size: 8 })
    a.setAttribute('aria-label', 'Cutoff value')
    const b = Object.assign(document.createElement('input'), { type: 'number', step: 'any', size: 8, hidden: true })
    b.setAttribute('aria-label', 'Upper value')
    const unit = Object.assign(document.createElement('span'), { className: 'note' })
    const remove = Object.assign(document.createElement('button'), { type: 'button', className: 'link', textContent: 'Remove' })
    const sync = () => {
      const m = list.find((x) => x.id === measure.value)
      unit.textContent = UNIT_WORDS[m?.unit] ?? m?.unit ?? ''
      b.hidden = op.value !== 'between'
    }
    measure.addEventListener('change', sync)
    op.addEventListener('change', sync)
    remove.addEventListener('click', () => row.remove())
    row._measures = list
    row.append(measure, ' ', op, ' ', a, ' ', b, ' ', unit, ' ', remove)
    rows.append(row)
    sync()
  }

  function conditionsNow() {
    const out = []
    for (const row of rows.children) {
      const [measure, op, a, b] = row.querySelectorAll('select, input')
      const m = row._measures.find((x) => x.id === measure.value)
      if (!m) continue
      if (a.value === '' || !Number.isFinite(Number(a.value))) throw new Error(`Enter a number for “${m.label}”.`)
      if (op.value === 'between' && (b.value === '' || !Number.isFinite(Number(b.value)))) throw new Error(`Enter both numbers for “${m.label}”.`)
      out.push({ measure: m, op: op.value, a: Number(a.value), b: op.value === 'between' ? Number(b.value) : undefined })
    }
    return out
  }

  async function run() {
    const lv = level()
    const st = state()
    let conditions
    try {
      conditions = conditionsNow()
    } catch (err) {
      return say(err.message)
    }
    if (!conditions.length) return say('Add a cutoff first.')
    say('Working…')
    try {
      // The map's level can change as it is zoomed: say so plainly if a chosen measure has no values at the level now showing.
      for (const c of conditions) {
        if (!(await available(c.measure, lv, st))) return say(`“${c.measure.label}” has no values for ${levelWord(lv)} here. Remove it, or choose another level on the map.`)
      }
      for (const c of conditions) c.table = await loadTable(c.measure.dataset, c.measure.table, lv, st)
      const shapes = await loadGeometry(lv, st)
      const ids = shapes.features.map((f) => f.id ?? f.properties.id).filter(Boolean)
      const result = findAreas(conditions, ids)
      last = { conditions, result, level: lv, state: st }
      const found = new Set(result.matches.map((m) => m.id))
      source.clear()
      source.addFeatures(
        new ol.format.GeoJSON().readFeatures(
          { type: 'FeatureCollection', features: shapes.features.filter((f) => found.has(f.id ?? f.properties.id)) },
          { featureProjection: 'EPSG:3857' },
        ),
      )
      show()
      const extent = source.getExtent()
      if (result.matches.length && extent && Number.isFinite(extent[0])) map.getView().fit(extent, { padding: [60, 60, 60, 60], maxZoom: 13, duration: 300 })
      say('')
    } catch (err) {
      say(err.message)
    }
  }

  function show() {
    const { conditions, result, level: lv } = last
    const near = result.matches.filter((m) => !m.sure).length
    const words = describeConditions(conditions, formatValue)
    const shown = [...result.matches].sort((x, y) => y.values[0].est - x.values[0].est).slice(0, SHOWN)
    const head = result.matches.length
      ? `<p><strong>${result.matches.length}</strong> of ${result.total} ${esc(levelWord(lv))} meet ${conditions.length === 1 ? 'the cutoff' : `all ${conditions.length} cutoffs`}:</p>`
      : `<p>No ${esc(levelWord(lv))} meet ${conditions.length === 1 ? 'the cutoff' : 'all the cutoffs'}.</p>`
    const table = result.matches.length
      ? `<table class="census"><thead><tr><th scope="col">Area</th>${conditions.map((c) => `<th scope="col">${esc(c.measure.label)}</th>`).join('')}</tr></thead><tbody>${shown
          .map(
            (m) =>
              `<tr><th scope="row" class="lbl">${esc(m.name)}${m.sure ? '' : ' <span class="note">near a cutoff</span>'}</th>${m.values.map((v, i) => `<td>${esc(formatValue(v.est, conditions[i].measure.unit))}</td>`).join('')}</tr>`,
          )
          .join('')}</tbody></table>${result.matches.length > SHOWN ? `<p class="note">The first ${SHOWN} are listed, ordered by the first measure; the download has all ${result.matches.length}.</p>` : ''}`
      : ''
    el('fw-result').innerHTML =
      `<ul class="plain">${words.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` +
      head +
      table +
      `<p class="note">${result.noValue ? `${result.noValue} ${esc(levelWord(lv))} had no value for at least one measure and could not be checked. ` : ''}${near ? `${near} meet the cutoffs on the estimate, but the 90 percent margin of error reaches across a cutoff, so they are marked “near a cutoff”. ` : ''}${moeText('Estimates are survey results with margins of error; modeled and rank measures have none.')}</p>` +
      (result.matches.length ? '<p><button type="button" id="fw-csv">Download CSV</button> <button type="button" id="fw-xlsx">Download Excel</button></p><p><label>Region name <input id="fw-region-name" type="text" maxlength="80" autocomplete="off" placeholder="High poverty, low income"></label> <button type="button" id="fw-region">Save these areas as a custom region</button></p>' : '')
    el('fw-csv')?.addEventListener('click', () => download('csv'))
    el('fw-xlsx')?.addEventListener('click', () => download('xlsx'))
    el('fw-region')?.addEventListener('click', () => {
      const name = saveRegion(el('fw-region-name').value, last.level, last.state, last.result.matches.map((x) => x.id))
      say(`Saved ${last.result.matches.length} ${levelWord(last.level)} as the region “${name}”. Find it under Custom regions.`)
    })
  }

  function download(kind) {
    if (!last) return
    const { conditions, result, level: lv, state: st } = last
    const notices = [
      `Areas meeting: ${describeConditions(conditions, formatValue).join('; ')}. ${lv}, state ${st}. Margins of error are at the 90 percent confidence level.`,
      ...new Set(conditions.map((c) => c.measure.credit).filter(Boolean)),
      API_NOTICE,
      'Boundaries: U.S. Census Bureau cartographic boundary files (1:500,000).',
    ]
    const grid = findGrid(conditions, result, notices)
    const blob = kind === 'csv' ? new Blob([mapCsv(grid)], { type: 'text/csv;charset=utf-8' }) : new Blob([toXlsx(grid, 'Find where')], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `find-where.${kind}` })
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  el('fw-add').addEventListener('click', () => addRow().catch((e) => say(e.message)))
  el('fw-go').addEventListener('click', run)
  el('fw-clear').addEventListener('click', () => {
    rows.replaceChildren()
    source.clear()
    last = null
    el('fw-result').replaceChildren()
    say('')
  })
  // Cutoffs belong to one level in one state: when either changes, the measure lists are stale, so start over.
  el('findwhere').addEventListener('toggle', () => {
    if (el('findwhere').open && !rows.children.length) addRow().catch((e) => say(e.message))
  })
  return {
    changed: () => {
      if (!rows.children.length && !last) return
      rows.replaceChildren()
      source.clear()
      last = null
      el('fw-result').replaceChildren()
      say('The map changed level or state, so the cutoffs were cleared.')
    },
  }
}

const UNIT_WORDS = {
  percent: 'percent',
  dollars: 'dollars',
  count: 'people or homes',
  years: 'years',
  days: 'days',
  celsius: '°C',
  ugm3: 'µg/m³',
  ppb: 'ppb',
  index: 'index',
  per100: 'per 100',
  per1000: 'per 1,000',
  per100k: 'per 100,000',
}
