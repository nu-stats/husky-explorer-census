// The Data tables page: source, then table, then area; read it here or download it.
import { esc } from './lib/chart.js'
import { LEVEL_NAMES, loadCatalog, loadIndex, loadTable } from './lib/data.js'
import { createPicker } from './lib/pick-ui.js'
import { searchTables, stackGrids, tableCsv, tableGrid } from './lib/tables.js'

const SOURCES = ['acs5-2024', 'acs1-2024', 'acs5-2019', 'dec-2020', 'dec-2010', 'dec-2000']
const LEVEL_ORDER = ['state', 'county', 'cousub', 'place', 'zcta', 'tract', 'blockgroup']
const NOTICE = 'This product uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau.'
const SHOWN_ROWS = 300

const el = (id) => document.getElementById(id)
const pick = { source: null, picked: [], catalog: null, grid: null } // picked: table ids, kept while the search narrows the list

const index = await loadIndex()
const stateCodes = Object.keys(index).sort((a, b) => index[a].name.localeCompare(index[b].name))
el('state').innerHTML = stateCodes.map((c) => `<option value="${c}">${esc(index[c].name)}</option>`).join('')
const params = new URLSearchParams(location.search)
if (params.get('s') && index[params.get('s')]) el('state').value = params.get('s')

const catalogs = Object.fromEntries(await Promise.all(SOURCES.map(async (id) => [id, await loadCatalog(id).catch(() => null)])))

function drawSources() {
  const state = el('state').value
  el('sources').innerHTML = SOURCES.filter((id) => catalogs[id] && index[state]?.datasets.includes(id))
    .map(
      (id) =>
        `<button type="button" class="source${pick.source === id ? ' on' : ''}" data-id="${id}"><b>${esc(catalogs[id].label)}</b><span class="note">${catalogs[id].tables.length} table${catalogs[id].tables.length === 1 ? '' : 's'}</span></button>`,
    )
    .join('')
  for (const b of el('sources').querySelectorAll('button')) b.onclick = () => chooseSource(b.dataset.id)
}

function chooseSource(id) {
  pick.source = id
  pick.catalog = catalogs[id]
  pick.picked = []
  pick.grid = null
  el('step2').hidden = false
  el('step3').hidden = true
  el('result').hidden = true
  el('find').value = ''
  drawSources()
  drawTables()
}

const picker = createPicker(el('tables'), {
  onChange: (ids) => {
    // The list shows only the tables that match the search; picks hidden by the search stay picked.
    const shown = new Set(searchTables(pick.catalog, el('find').value).map((t) => t.id))
    pick.picked = [...pick.picked.filter((id) => !shown.has(id)), ...ids]
    choosePicked()
  },
})

function drawTables() {
  const found = searchTables(pick.catalog, el('find').value)
  el('tcount').textContent = `${found.length} of ${pick.catalog.tables.length} tables`
  picker.setItems(found.map((t) => ({ id: t.id, label: `${t.id} ${t.concept}` })))
  picker.select(pick.picked)
}

// The kinds of area the state was built at, shown from the start so the choice is never hidden; the one picked is kept
// when the state changes, if that state has it too.
function drawLevels() {
  const state = el('state').value
  const have = index[state]?.levels ?? []
  const was = el('level').value
  const levels = LEVEL_ORDER.filter((l) => have.includes(l))
  el('level').innerHTML = levels.map((l) => `<option value="${l}">${esc(l === 'state' ? 'the state as a whole' : LEVEL_PLURALS[l] ?? LEVEL_NAMES[l])}</option>`).join('')
  el('level').value = levels.includes(was) ? was : levels.includes('county') ? 'county' : levels[0]
}
const LEVEL_PLURALS = { county: 'counties', cousub: 'towns and townships', place: 'cities and places', zcta: 'ZIP code areas', tract: 'tracts', blockgroup: 'block groups' }

function choosePicked() {
  pick.grid = null
  el('result').hidden = true
  el('step3').hidden = !pick.picked.length
  const tables = pickedTables()
  el('chosen').textContent = tables.length === 1 ? `${tables[0].id}: ${tables[0].concept}` : `${tables.length} tables: ${tables.map((t) => t.id).join(', ')}`
}

// A 2010 or 2000 count filed a second time under a town's or city's current code (its code changed, its land did not) is
// left out of the table, so every area is counted once in the download.
const ownRows = (file) => ({ ...file, rows: Object.fromEntries(Object.entries(file.rows).filter(([, r]) => !r.also)) })

const pickedTables = () => pick.catalog.tables.filter((t) => pick.picked.includes(t.id))

async function show() {
  const state = el('state').value
  const level = el('level').value
  el('status').textContent = 'Loading…'
  const parts = []
  const missing = []
  for (const table of pickedTables()) {
    try {
      const t = await loadTable(pick.source, table.id, level, state)
      parts.push({ table, title: `${pick.catalog.label}: ${table.id} ${table.concept}`, grid: tableGrid(ownRows(t.file), table, el('area').value) })
    } catch {
      missing.push(table.id)
    }
  }
  el('status').textContent = missing.length ? `${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not built at that level for this state, so left out. Try another level.` : ''
  if (!parts.length) {
    pick.grid = null
    el('result').hidden = true
    return
  }
  pick.grid = stackGrids(parts)
  const n = parts.reduce((sum, p) => sum + p.grid.length - 1, 0)
  el('result').hidden = false
  el('rcount').textContent = `${parts.length} table${parts.length === 1 ? '' : 's'}, ${n} row${n === 1 ? '' : 's'} in all${parts.some((p) => p.grid.length - 1 > SHOWN_ROWS) ? `; at most ${SHOWN_ROWS} rows of each are shown here, the download has all` : ''}`
  el('grid').innerHTML = parts
    .map((p) => {
      const rows = p.grid.slice(0, SHOWN_ROWS + 1)
      return (
        `<caption>${esc(p.title)}</caption><thead><tr>${rows[0].map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>` +
        rows.slice(1).map((r) => `<tr><th scope="row" class="lbl">${esc(r[0])}</th>${r.slice(1).map((x) => `<td>${typeof x === 'number' ? x.toLocaleString('en-US') : esc(x)}</td>`).join('')}</tr>`).join('') +
        '</tbody>'
      )
    })
    .map((h) => `<table class="census">${h}</table>`)
    .join('')
}

el('state').onchange = () => {
  pick.source = null
  el('step2').hidden = true
  el('step3').hidden = true
  el('result').hidden = true
  drawLevels()
  drawSources()
}
el('level').onchange = () => {
  pick.grid = null
  el('result').hidden = true
}
el('find').oninput = () => pick.catalog && drawTables()
el('show').onclick = show
el('download').onclick = () => {
  if (!pick.grid) return
  const blob = new Blob([tableCsv(pick.grid, NOTICE)], { type: 'text/csv' })
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${pick.source}-${pick.picked.length === 1 ? pick.picked[0] : pick.picked.length + 'tables'}-${el('level').value}-${el('state').value}.csv` })
  a.click()
  URL.revokeObjectURL(a.href)
}

drawLevels()
drawSources()
