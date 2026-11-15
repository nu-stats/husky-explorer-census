// Campus crime reports: find a school by name or on the map, then see its Clery Act counts for a year, the change from its
// earliest to its latest report, and the trend. The numbers are crimes reported to campus officials and police, as each
// school counted them: not all crime, not victimization, and not comparable between schools (the cautions say so).
import { esc, niceMax } from './lib/chart.js'
import {
  CAMPUS_CAUTIONS,
  changeOver,
  compareYears,
  comparisonCsv,
  comparisonSvg,
  describeChange,
  enrollmentFor,
  grouped,
  hasSeries,
  institutionCsv,
  institutionSeries,
  MIN_FOR_PERCENT,
  PLACE_ORDER,
  perThousand,
  searchInstitutions,
  SEX_OFFENSE_BREAK,
  SEX_OFFENSE_IDS,
  tableForYear,
} from './lib/campus.js'

const el = (id) => document.getElementById(id)
const count = (n) => n.toLocaleString('en-US')
const rateText = (r) => (r === null ? '' : `${r < 10 ? r.toFixed(2) : r.toFixed(1)} per 1,000`)

let data = null
let current = null
const cache = new Map()

const SECTOR_COLORS = { public: '#1f77b4', nonprofit: '#c8102e', forprofit: '#e08a00' }
const sectorOf = (code) => (code === 1 || code === 4 || code === 7 ? 'public' : code === 2 || code === 5 || code === 8 ? 'nonprofit' : 'forprofit')

function cautionsHtml() {
  return CAMPUS_CAUTIONS.map(([t, d]) => `<li><b>${esc(t)}.</b> ${esc(d)}</li>`).join('')
}
el('cautions-intro').innerHTML = `<h3>Before you use these numbers</h3><ol>${cautionsHtml()}</ol>`

el('legend').innerHTML = `Dots are schools, placed at the main location in the federal directory. Color is the kind of school, not a crime count. ${Object.entries({ public: 'Public', nonprofit: 'Private nonprofit', forprofit: 'Private for-profit' }).map(([k, v]) => `<span class="sw" style="background:${SECTOR_COLORS[k]}"></span>${v}`).join('')}`

async function load() {
  const res = await fetch('/husky-explorer-census/data/campus/index.json')
  if (!res.ok) throw new Error('There is no campus crime file yet. Run “Fetch data” first.')
  return res.json()
}

async function institution(id) {
  if (!cache.has(id)) {
    const res = await fetch(`/husky-explorer-census/data/campus/inst/${encodeURIComponent(id)}.json`)
    if (!res.ok) throw new Error('That school’s file could not be read.')
    cache.set(id, await res.json())
  }
  return cache.get(id)
}

// ---- search
function showResults() {
  const hits = searchInstitutions(data.institutions, el('q').value)
  el('results').innerHTML = hits
    .map(
      (r) =>
        `<li><button type="button" data-id="${esc(r.id)}">${esc(r.n)}${r.cl ? ' (closed)' : ''}<small>${esc(r.c)}, ${esc(r.s)} · ${r.nc} campus${r.nc === 1 ? '' : 'es'}${r.y ? ` · reports ${r.y[0]} to ${r.y[1]}` : ''}</small></button></li>`,
    )
    .join('')
  if (el('q').value.trim() && !hits.length) el('results').innerHTML = '<li class="note">No school matches. Try fewer words.</li>'
}

// ---- map
let mapApi = null
function setupMap() {
  if (typeof ol === 'undefined') {
    el('map').textContent = 'The map library did not load; use the search box.'
    return
  }
  const features = data.institutions
    .filter((r) => r.la !== null && r.lo !== null)
    .map((r) => {
      const f = new ol.Feature({ geometry: new ol.geom.Point(ol.proj.fromLonLat([r.lo, r.la])) })
      f.set('id', r.id)
      f.set('name', r.n)
      f.set('place', `${r.c}, ${r.s}`)
      f.set('sector', sectorOf(r.sc))
      return f
    })
  const styles = {}
  for (const [k, c] of Object.entries(SECTOR_COLORS)) styles[k] = new ol.style.Style({ image: new ol.style.Circle({ radius: 4, fill: new ol.style.Fill({ color: c }), stroke: new ol.style.Stroke({ color: '#fff', width: 1 }) }) })
  const selected = new ol.style.Style({ image: new ol.style.Circle({ radius: 8, fill: new ol.style.Fill({ color: 'rgba(200,16,46,.25)' }), stroke: new ol.style.Stroke({ color: '#c8102e', width: 2 }) }), zIndex: 10 })
  let selectedId = null
  const layer = new ol.layer.Vector({
    source: new ol.source.Vector({ features }),
    style: (f) => (f.get('id') === selectedId ? [styles[f.get('sector')], selected] : styles[f.get('sector')]),
  })
  const map = new ol.Map({
    target: 'map',
    layers: [new ol.layer.Tile({ source: new ol.source.OSM() }), layer],
    view: new ol.View({ center: ol.proj.fromLonLat([-96, 38.5]), zoom: 3.4, minZoom: 2, maxZoom: 14 }),
  })
  const tip = document.createElement('div')
  tip.style.cssText = 'position:absolute;pointer-events:none;background:#222;color:#fff;padding:3px 7px;border-radius:4px;font-size:12px;display:none;white-space:nowrap;z-index:5'
  el('map').style.position = 'relative'
  el('map').append(tip)
  map.on('pointermove', (e) => {
    const f = map.forEachFeatureAtPixel(e.pixel, (x) => x)
    map.getTargetElement().style.cursor = f ? 'pointer' : ''
    tip.style.display = f ? 'block' : 'none'
    if (f) {
      tip.textContent = `${f.get('name')} (${f.get('place')})`
      tip.style.left = `${e.pixel[0] + 10}px`
      tip.style.top = `${e.pixel[1] + 10}px`
    }
  })
  map.on('click', (e) => {
    // Dots can overlap in a city: the nearest one under the click is taken.
    const f = map.forEachFeatureAtPixel(e.pixel, (x) => x, { hitTolerance: 3 })
    if (f) select(f.get('id'), false)
  })
  mapApi = {
    show(id) {
      selectedId = id
      layer.changed()
      const f = layer.getSource().getFeatures().find((x) => x.get('id') === id)
      if (f) map.getView().animate({ center: f.getGeometry().getCoordinates(), zoom: Math.max(map.getView().getZoom(), 9), duration: 400 })
    },
  }
}

// ---- the school
async function select(id, fromSearch = true) {
  el('status').textContent = 'Loading…'
  try {
    current = await institution(id)
  } catch (e) {
    el('status').textContent = e.message
    return
  }
  el('status').textContent = ''
  history.replaceState(null, '', `#${id}`)
  mapApi?.show(id)
  if (fromSearch) el('results').replaceChildren()
  draw()
}

const years = () => data.meta.years
const category = (id) => data.categories.find((c) => c.id === id)

function flags() {
  const out = []
  if (current.closed) out.push(`The federal directory lists this school as closed, so its series ends; the last year with a figure is ${current.years?.[1] ?? 'unknown'}.`)
  if (current.newId) out.push(`The directory gives a successor school (id ${esc(current.newId)}). The two are not joined here, because the files do not say how their campuses carry over.`)
  if (current.campuses.length > 1) out.push(`This page adds up ${current.campuses.length} U.S. campuses (${current.campuses.map((c) => esc(c.name)).join(', ')}). Campuses abroad are left out, so a total here can be smaller than the Department of Education’s own screen for the school. Enrollment is one figure for the whole institution, so rates are not shown for a single campus.`)
  return out.map((t) => `<div class="flag">${t}</div>`).join('')
}

function draw() {
  const inst = current
  el('intro').hidden = true
  el('school').hidden = false
  el('name').textContent = inst.name
  el('facts').textContent = `${inst.city}, ${inst.state} · ${inst.sector}${inst.county ? ` · ${inst.county}` : ''} · IPEDS unit id ${inst.id}${inst.years ? ` · reports for calendar years ${inst.years[0]} to ${inst.years[1]}` : ' · no reports'}`
  el('flags').innerHTML = flags()
  el('cautions').innerHTML = cautionsHtml()
  const held = inst.years
  const yearSel = el('year')
  const previous = Number(yearSel.value)
  if (!held) {
    el('table').innerHTML = '<p>This school has no figures in the files.</p>'
    el('change').innerHTML = ''
    el('chart').innerHTML = ''
    return
  }
  const options = []
  for (let y = held[1]; y >= held[0]; y--) options.push(`<option value="${y}">${y}</option>`)
  yearSel.innerHTML = options.join('')
  yearSel.value = previous >= held[0] && previous <= held[1] ? String(previous) : String(held[1])
  const places = PLACE_ORDER.filter((p) => data.categories.some((c) => hasSeries(inst, p, c.id)))
  el('campus-label').hidden = inst.campuses.length < 2
  el('campus').innerHTML = `<option value="all">All ${inst.campuses.length} U.S. campuses added up</option>` + inst.campuses.map((c) => `<option value="${c.branch}">${esc(c.name)} only (${esc(c.city)}, ${esc(c.state)})</option>`).join('')
  el('place').innerHTML = places.map((p) => `<option value="${p}">${esc(data.meta.places[p])}</option>`).join('')
  const cats = data.categories.filter((c) => PLACE_ORDER.some((p) => hasSeries(inst, p, c.id)))
  el('cat').innerHTML = cats.map((c) => `<option value="${c.id}">${esc(c.group)}: ${esc(c.label)}</option>`).join('')
  const prefer = cats.find((c) => c.id === 'c_burgla') ?? cats[0]
  if (prefer) el('cat').value = prefer.id
  // The two years to compare: the last five by default, or what was chosen for the previous school when it fits this one.
  const keep = (id, fallback) => {
    const sel = el(id)
    const before = Number(sel.value)
    sel.innerHTML = options.join('')
    sel.value = before >= held[0] && before <= held[1] ? String(before) : String(fallback)
  }
  keep('ya', Math.max(held[0], held[1] - 5))
  keep('yb', held[1])
  el('cmp-place').innerHTML = el('place').innerHTML
  drawTable()
  drawChange()
  drawCompare()
  drawChart()
}

/** The institution (every U.S. campus added up), or one campus of it: a campus has no rates, because enrollment is for the whole institution. */
function view() {
  const k = el('campus').value
  const c = k && k !== 'all' ? current.campuses.find((x) => String(x.branch) === k) : null
  return c ? { ...current, campuses: [c], enrollment: {}, singleCampus: true } : current
}

function drawTable() {
  const inst = view()
  const year = Number(el('year').value)
  const e = enrollmentFor(inst, year)
  el('table-title').textContent = `Reports in ${year}`
  el('enroll').textContent = inst.singleCampus
    ? 'Rates are not shown for a single campus: enrollment is one figure for the whole institution, so a campus rate would divide by the wrong number.'
    : e
    ? `Enrollment used for rates: ${count(e.total)}, the figure in the ${e.collection} report: one number for the whole institution (IPEDS fall enrollment, as the Department of Education gives it). People who are not students are not in it.`
    : 'No enrollment figure for this year, so no rates are shown.'
  const all = tableForYear(inst, data.categories, year, years())
  // A kind of crime with no figure in any place that year (not asked yet, or no longer asked) is named below, not shown as a row of dashes.
  const rows = all.filter((r) => PLACE_ORDER.some((p) => typeof r.values[p] === 'number'))
  const absent = all.filter((r) => !rows.includes(r) && !r.group.startsWith('Hate'))
  const heads = PLACE_ORDER.filter((p) => rows.some((r) => r.values[p] !== undefined))
  const cell = (v) => {
    if (v === undefined) return '<td></td>'
    if (v === null) return '<td class="none" title="No figure for this year">–</td>'
    // A rate of 0 says nothing more than the 0 does.
    const rt = e && v > 0 ? rateText(perThousand(v, e.total)) : ''
    return `<td><b>${count(v)}</b>${rt ? `<span class="rate">${rt}</span>` : ''}</td>`
  }
  const table = (g) =>
    `<table class="census"><thead><tr><th scope="col">${esc(g.group)}</th>${heads.map((p) => `<th scope="col">${esc(data.meta.places[p])}</th>`).join('')}</tr></thead><tbody>` +
    g.rows.map((r) => `<tr><th scope="row" class="lbl">${esc(r.label)}${r.note ? `<span class="small">${esc(r.note)}</span>` : ''}</th>${heads.map((p) => cell(r.values[p])).join('')}</tr>`).join('') +
    '</tbody></table>'
  // Hate crimes sit in their own folded tables, beside the criminal offenses and never added to them.
  el('table').innerHTML =
    grouped(rows)
      .map((g) => {
        if (!g.group.startsWith('Hate')) return table(g)
        const total = g.rows.reduce((s, r) => s + (r.values.on ?? 0), 0)
        return `<details><summary>${esc(g.group)}: ${total ? `${count(total)} reported on campus in ${year}` : `none reported on campus in ${year}`}</summary>${table(g)}</details>`
      })
      .join('') +
    (absent.length ? `<p class="note">No figure for ${year}: ${absent.map((r) => esc(r.label)).join(', ')}. (A kind of crime that was added or retired in a definition change has figures only for the years it was counted.)</p>` : '')
}

function drawChange() {
  const inst = view()
  const place = el('place').value
  const [from, to] = years()
  const held = inst.years
  const rows = []
  for (const c of data.categories) {
    if (!hasSeries(inst, place, c.id)) continue
    const series = institutionSeries(inst, place, c.id, years())
    const ch = changeOver(series, from, held[0], held[1], (y) => enrollmentFor(inst, y))
    // A kind of crime reported as 0 in every year has no change to show; it is named below the table.
    rows.push({ c, ch, zero: series.every((v) => v === null || v === 0) })
  }
  const shown = rows.filter((r) => !r.zero)
  const zeros = rows.filter((r) => r.zero)
  el('change-note').textContent = `From the first year with a figure to the last, for ${data.meta.places[place].toLowerCase()}. A percent change is not shown when the earlier count is under ${MIN_FOR_PERCENT}. A category that began later (rape and fondling from 2014, for example) starts at its own first year; it is not compared with the older sex offense categories.`
  const body = grouped(shown.map((r) => ({ ...r.c, ch: r.ch })))
    .map(
      (g) =>
        `<tbody><tr class="group"><th colspan="5" scope="colgroup">${esc(g.group)}</th></tr>` +
        g.rows
          .map((r) => {
            const ch = r.ch
            if (!ch) return `<tr><th scope="row" class="lbl">${esc(r.label)}</th><td colspan="4" class="none">Only one year has a figure</td></tr>`
            const pct = ch.percent === null ? `<span class="small" title="${esc(ch.reason)}">no percent: earlier count under ${MIN_FOR_PERCENT}</span>` : `<span class="small">${ch.percent > 0 ? '+' : ''}${ch.percent.toFixed(0)}%</span>`
            const late = ch.startsLate ? `<span class="small">from ${ch.from.year}</span>` : ''
            const early = ch.endsEarly ? `<span class="small">last figure ${ch.to.year}</span>` : ''
            return `<tr><th scope="row" class="lbl">${esc(r.label)}</th><td>${count(ch.from.value)}<span class="small">${ch.from.year}${!ch.rateFrom ? '' : ` · ${rateText(ch.rateFrom)}`}</span>${late}</td><td>${count(ch.to.value)}<span class="small">${ch.to.year}${!ch.rateTo ? '' : ` · ${rateText(ch.rateTo)}`}</span>${early}</td><td title="${esc(describeChange(ch))}">${ch.diff > 0 ? '+' : ''}${count(ch.diff)}${pct}</td></tr>`
          })
          .join('') +
        '</tbody>',
    )
    .join('')
  const zeroHate = zeros.filter((r) => r.c.group.startsWith('Hate')).length
  const zeroOther = zeros.filter((r) => !r.c.group.startsWith('Hate'))
  const zeroNote = zeros.length
    ? `<p class="note">Reported as 0 in every year with a figure: ${[...zeroOther.map((r) => esc(r.c.group === 'Criminal offenses' ? r.c.label : `${r.c.group}: ${r.c.label}`)), ...(zeroHate ? [`${zeroHate} kinds of hate crime`] : [])].join('; ')}.</p>`
    : ''
  el('change').innerHTML = (shown.length ? `<table class="census"><thead><tr><th scope="col">Kind of crime</th><th scope="col">Earliest year</th><th scope="col">Latest year</th><th scope="col">Change</th></tr></thead>${body}</table>` : '<p>No figures in this place.</p>') + zeroNote
}

let compared = null // { rows, place, rate } for the downloads

function drawCompare() {
  const inst = view()
  const place = el('cmp-place').value
  if (!place) return
  const ya = Number(el('ya').value)
  const yb = Number(el('yb').value)
  const rateOk = !inst.singleCampus && enrollmentFor(inst, ya) && enrollmentFor(inst, yb)
  const rate = el('cmp-unit').value === 'rate' && !!rateOk
  el('cmp-unit').querySelector('option[value="rate"]').disabled = !rateOk
  if (!rateOk) el('cmp-unit').value = 'count'
  const rows = compareYears(inst, data.categories, place, years(), ya, yb)
  compared = { rows, place, rate }
  for (const id of ['cmp-csv', 'cmp-png', 'cmp-svg']) el(id).disabled = !rows.length
  const [a, b] = ya <= yb ? [ya, yb] : [yb, ya]
  el('cmp-note').textContent =
    ya === yb
      ? 'Pick two different years to compare.'
      : `${data.meta.places[place]}, ${a} and ${b}. A blank year is no figure, not a zero. A percent change is not shown when the earlier count is under ${MIN_FOR_PERCENT}.${rateOk ? '' : ' Rates need an enrollment figure for both years and the whole institution.'}`
  if (ya === yb || !rows.length) {
    el('cmp-chart').innerHTML = ''
    el('cmp-table').innerHTML = ya === yb ? '' : '<p>No figures in this place for either year.</p>'
    for (const id of ['cmp-csv', 'cmp-png', 'cmp-svg']) el(id).disabled = true
    return
  }
  el('cmp-chart').innerHTML = comparisonSvg(rows, { school: current.name, place: data.meta.places[place], rate })
  const val = (v) => (v === null ? '<td class="none" title="No figure for this year">–</td>' : `<td><b>${count(v)}</b></td>`)
  const body = grouped(rows.map((r) => ({ ...r.cat, ...r })))
    .map(
      (g) =>
        `<tbody><tr class="group"><th colspan="5" scope="colgroup">${esc(g.group)}</th></tr>` +
        g.rows
          .map((r) => {
            const ch = r.ch
            const pct = ch.percent === null ? '' : `<span class="small">${ch.percent > 0 ? '+' : ''}${ch.percent.toFixed(0)}%</span>`
            const why = [ch.diff !== null && ch.percent === null && ch.a.value > 0 ? ch.reason : '', r.breaks ? 'The definition of this category changed between these years, so this is not a like-for-like change.' : ''].filter(Boolean)
            return `<tr><th scope="row" class="lbl">${esc(r.label)}${why.map((w) => `<span class="small">${esc(w)}</span>`).join('')}</th>${val(ch.a.value)}${val(ch.b.value)}<td>${ch.diff === null ? '<span class="none" title="' + esc(ch.reason) + '">–</span>' : `${ch.diff > 0 ? '+' : ''}${count(ch.diff)}${pct}`}</td></tr>`
          })
          .join('') +
        '</tbody>',
    )
    .join('')
  el('cmp-table').innerHTML = `<table class="census"><thead><tr><th scope="col">Kind of crime</th><th scope="col">${a}</th><th scope="col">${b}</th><th scope="col">Change</th></tr></thead>${body}</table>`
}

function save(name, blob) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

const cmpName = (ext) => `campus-crime-${current.id}-${compared.rows[0].ch.a.year}-vs-${compared.rows[0].ch.b.year}-${compared.place}.${ext}`
const NOTICE = 'U.S. Department of Education, Office of Postsecondary Education, Campus Safety and Security data (Clery Act); enrollment from IPEDS. Not endorsed by either.'

function drawChart() {
  const inst = view()
  const id = el('cat').value
  const place = el('place').value
  if (!id) return
  const [from, to] = years()
  const rate = el('unit').value === 'rate'
  const counts = institutionSeries(inst, place, id, years())
  const values = counts.map((v, i) => (rate ? perThousand(v, enrollmentFor(inst, from + i)?.total) : v))
  const W = 680
  const H = 270
  const m = { l: 46, r: 14, t: 14, b: 30 }
  const top = niceMax(Math.max(0, ...values.filter((v) => v !== null)))
  const x = (i) => m.l + (i * (W - m.l - m.r)) / (to - from)
  const y = (v) => H - m.b - (v / top) * (H - m.t - m.b)
  const parts = []
  // Whole-number steps where the counts allow: a top of 2, 20, 200 is cut in 4, any other in 5.
  const parts10 = top / 10 ** Math.floor(Math.log10(top))
  const steps = !rate && top <= 5 ? top : Math.round(parts10) === 2 ? 4 : 5
  const dec = top / steps >= 1 ? 0 : top / steps >= 0.1 ? 1 : 2
  for (let k = 0; k <= steps; k++) {
    const v = (top * k) / steps
    parts.push(`<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${rate ? v.toFixed(dec) : count(Math.round(v))}</text>`)
  }
  for (let yr = from; yr <= to; yr++) if ((yr - from) % 3 === 0 || yr === to) parts.push(`<text x="${x(yr - from)}" y="${H - 10}" text-anchor="middle">${yr}</text>`)
  parts.push(`<line class="axis" x1="${m.l}" x2="${W - m.r}" y1="${y(0)}" y2="${y(0)}"/>`)
  if (SEX_OFFENSE_IDS.includes(id)) {
    const bx = (x(SEX_OFFENSE_BREAK[0] - from) + x(SEX_OFFENSE_BREAK[1] - from)) / 2
    parts.push(`<line class="break" x1="${bx}" x2="${bx}" y1="${m.t}" y2="${H - m.b}"/><text x="${bx + 4}" y="${m.t + 10}">definitions change</text>`)
  }
  // A year with no figure breaks the line; a 0 is drawn as a 0.
  let run = []
  const flush = () => {
    if (run.length > 1) parts.push(`<polyline class="line" points="${run.map(([i, v]) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}"/>`)
    run = []
  }
  values.forEach((v, i) => {
    if (v === null) return flush()
    run.push([i, v])
    if (values[i + 1] === null || values[i + 1] === undefined) flush()
  })
  values.forEach((v, i) => {
    if (v !== null) parts.push(`<circle class="dot" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3"><title>${from + i}: ${rate ? rateText(v) : count(counts[i])} reports</title></circle>`)
  })
  const cat = category(id)
  el('chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(cat.label)} by year, ${esc(data.meta.places[place])}">${parts.join('')}</svg>`
  const gaps = values.filter((v) => v === null).length
  el('chart-note').textContent = `${cat.label}, ${data.meta.places[place].toLowerCase()}, ${rate ? 'reports per 1,000 students' : 'reports'}. ${gaps ? `${gaps} year${gaps === 1 ? ' has' : 's have'} no figure (a gap in the line, not a zero). ` : ''}${cat.note ? cat.note + ' ' : ''}Small counts change a lot on one or two reports.`
}

// ---- wiring
el('q').addEventListener('input', showResults)
el('results').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-id]')
  if (b) select(b.dataset.id)
})
el('campus').addEventListener('change', () => {
  drawTable()
  drawChange()
  drawCompare()
  drawChart()
})
el('year').addEventListener('change', drawTable)
el('place').addEventListener('change', () => {
  drawChange()
  drawChart()
})
el('cat').addEventListener('change', drawChart)
el('unit').addEventListener('change', drawChart)
el('csv').addEventListener('click', () => {
  const csv = institutionCsv(current, data.categories, years(), data.meta.places, [
    'U.S. Department of Education, Office of Postsecondary Education, Campus Safety and Security data (Clery Act); enrollment from IPEDS. Not endorsed by either.',
    ...data.meta.limits.slice(0, 5).map((l) => l),
  ])
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), download: `campus-crime-${current.id}.csv` })
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
})

for (const id of ['ya', 'yb', 'cmp-place', 'cmp-unit']) el(id).addEventListener('change', drawCompare)
el('cmp-csv').addEventListener('click', () => {
  if (!compared?.rows.length) return
  save(cmpName('csv'), new Blob([comparisonCsv(view(), data.meta.places[compared.place], compared.rows, [NOTICE, ...data.meta.limits.slice(0, 5)])], { type: 'text/csv;charset=utf-8' }))
})
const cmpSvg = () => comparisonSvg(compared.rows, { school: current.name, place: data.meta.places[compared.place], rate: compared.rate })
el('cmp-svg').addEventListener('click', () => compared?.rows.length && save(cmpName('svg'), new Blob([cmpSvg()], { type: 'image/svg+xml' })))
el('cmp-png').addEventListener('click', () => {
  if (!compared?.rows.length) return
  const svg = cmpSvg()
  const [, w, h] = /viewBox="0 0 (\d+) (\d+)"/.exec(svg)
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = w * 2
    canvas.height = h * 2
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => blob && save(cmpName('png'), blob), 'image/png')
  }
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
})

// The back button and a shared link (#<unit id>) open that school.
window.addEventListener('hashchange', () => {
  const id = location.hash.replace('#', '')
  if (data && /^\d{6}$/.test(id) && id !== current?.id) select(id, false)
})

load()
  .then((d) => {
    data = d
    setupMap()
    const id = location.hash.replace('#', '')
    if (/^\d{6}$/.test(id)) select(id)
  })
  .catch((e) => {
    el('status').textContent = e.message
  })
