// The data sources page: the measures list as a searchable catalog.
import { esc } from './lib/chart.js'
import { LEVEL_NAMES } from './lib/data.js'
import { HEAT_MEASURES } from './lib/heat.js'
import { clearedNationalFiles, HELD_BACK, HELD_BACK_NATIONAL, isCleared } from './lib/clearance.js'
import { MEASURES } from './lib/measures.js'
import { POINT_LAYERS } from './lib/about.js'
import { catalogCsv, catalogRows, nationalRows, RELATED, RULES } from './lib/sources.js'
import { SITE } from './lib/site.js'

const el = (id) => document.getElementById(id)
const NATIONAL_FILES = clearedNationalFiles(['ncvs-2024.json', 'yrbs-2025.json', 'brfss-2025.json', 'nsduh-2024.json', 'atus-2025.json'])
// Heat measures of a source this copy does not hold are left out (a site profile may keep wet-bulb and not ERA5-Land).
const heat = HEAT_MEASURES.filter((m) => isCleared(m.source === 'prism' ? 'wetbulb-prism' : 'heat-2000-2020'))
const rows = catalogRows(MEASURES, heat, { ...LEVEL_NAMES, state: 'state' })

const held = document.createElement('section')
if (SITE) held.innerHTML = `<h3>What this site holds</h3><p class="note">${esc(SITE.title)}. It holds U.S. Census Bureau data for every county, town, tract, block group and ZIP code area it was built for, and for the cities of the assignment (cities and places are limited to that list), with federal sources whose terms are clear: the measures listed here and the dot layers below. Husky Explorer’s crime, campus crime and survey data are not on this site.</p>`
else held.innerHTML = `<h3>Held back until the terms are confirmed</h3><p class="note">These sources are not on the hosted site. The American Time Use Survey shows on the Survey data page on your own computer only, as a preview for checking.</p><ul class="note" style="color:#888">${[...HELD_BACK, ...HELD_BACK_NATIONAL].map((d) => `<li>${esc(d.name)}: ${esc(d.why)}</li>`).join('')}</ul>`
el('catalog').after(held)

el('rules').innerHTML =RULES.map(([t, d]) => `<dt>${esc(t)}</dt><dd class="note">${esc(d)}</dd>`).join('')

function draw() {
  const q = el('filter').value.trim().toLowerCase()
  const shown = q ? rows.filter((r) => Object.values(r).join(' ').toLowerCase().includes(q)) : rows
  el('count').textContent = `${shown.length} of ${rows.length} measures`
  const groups = new Map()
  for (const r of shown) {
    if (!groups.has(r.group)) groups.set(r.group, [])
    groups.get(r.group).push(r)
  }
  el('catalog').innerHTML = [...groups]
    .map(
      ([g, list]) =>
        `<h3>${esc(g)}</h3><table class="census"><thead><tr><th scope="col">Measure</th><th scope="col">Source</th><th scope="col">Where it exists</th><th scope="col">Boundaries</th><th scope="col">Kind of number</th></tr></thead><tbody>` +
        list
          .map(
            (r) =>
              `<tr><th scope="row" class="lbl">${esc(r.measure)}</th><td>${esc(r.source)}<br><span class="note">${esc(r.publisher)}</span></td><td>${esc(r.where)}</td><td>${esc(r.boundaries)}</td><td>${esc(r.kind)}</td></tr>` +
              `<tr><td colspan="5" class="note"><strong>Credit and terms:</strong> ${esc(r.credit)}${r.note ? `<br>${esc(r.note)}` : ''}${r.about?.length ? `<br><strong>Read about it elsewhere:</strong> ${r.about.map(([label, url]) => `<a href="${esc(url)}" rel="noopener noreferrer">${esc(label)}</a>`).join(' · ')}` : ''}</td></tr>`,
          )
          .join('') +
        '</tbody></table>',
    )
    .join('')
}

el('points').innerHTML = POINT_LAYERS.map((p) => `<h3>${esc(p.name)}</h3><p class="note">${esc(p.publisher)}. Read about it elsewhere: ${p.about.map(([label, url]) => `<a href="${esc(url)}" rel="noopener noreferrer">${esc(label)}</a>`).join(' · ')}</p>`).join('')

el('related').innerHTML = RELATED.map((r) => `<h3>${esc(r.name)}</h3><p>${esc(r.what)}</p><ul>${r.links.map(([label, url]) => `<li><a href="${esc(url)}" rel="noopener noreferrer">${esc(label)}</a></li>`).join('')}</ul><p class="note"><strong>Terms:</strong> ${esc(r.terms)}</p>`).join('')

Promise.all(NATIONAL_FILES.map((name) => fetch(`/husky-explorer-census/data/national/${name}`).then((res) => (res.ok ? res.json() : null)).catch(() => null)))
  .then((files) => {
    const list = files.flatMap((f) => nationalRows(f))
    if (!list.length) return
    el('national').innerHTML = list
      .map(
        (r) =>
          `<h3>${esc(r.name)}</h3><table class="census"><tbody>` +
          `<tr><th scope="row" class="lbl">Source</th><td>${esc(r.who)}. <a href="${esc(r.page)}" rel="noopener noreferrer">Report page</a> · <a href="${esc(r.source)}" rel="noopener noreferrer">Table files</a></td></tr>` +
          `<tr><th scope="row" class="lbl">Year</th><td>${esc(r.year)}</td></tr><tr><th scope="row" class="lbl">Retrieved</th><td>${esc(r.retrieved)}</td></tr>` +
          `<tr><th scope="row" class="lbl">Geography</th><td>${esc(r.geography)}</td></tr>` +
          `<tr><th scope="row" class="lbl">Limits</th><td><ul>${r.limits.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></td></tr>` +
          `<tr><th scope="row" class="lbl">Tables held</th><td><ul>${r.tables.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></td></tr>` +
          `<tr><th scope="row" class="lbl">Credit and terms</th><td>${esc(r.terms)}${r.about.length ? `<br><strong>Read about it elsewhere:</strong> ${r.about.map(([label, url]) => `<a href="${esc(url)}" rel="noopener noreferrer">${esc(label)}</a>`).join(' · ')}` : ''}</td></tr></tbody></table>`,
      )
      .join('')
  })
  .catch(() => {})

// A site profile holds no campus data.
;(SITE ? Promise.resolve(null) : fetch('/husky-explorer-census/data/campus/index.json'))
  .then((res) => (res?.ok ? res.json() : null))
  .then((file) => {
    const list = nationalRows(file ? { ...file, tables: file.categories.map((c) => ({ title: `${c.group}: ${c.label}` })) } : null)
    if (!list.length) return
    el('campus').innerHTML = list
      .map(
        (r) =>
          `<h3>${esc(r.name)}</h3><table class="census"><tbody>` +
          `<tr><th scope="row" class="lbl">Source</th><td>${esc(r.who)}. <a href="${esc(r.page)}" rel="noopener noreferrer">Campus Safety and Security data</a> · <a href="${esc(r.source)}" rel="noopener noreferrer">Newest file</a></td></tr>` +
          `<tr><th scope="row" class="lbl">Calendar years</th><td>${esc(r.year)}</td></tr><tr><th scope="row" class="lbl">Retrieved</th><td>${esc(r.retrieved)}</td></tr>` +
          `<tr><th scope="row" class="lbl">Geography</th><td>${esc(r.geography)}</td></tr>` +
          `<tr><th scope="row" class="lbl">Limits</th><td><ul>${r.limits.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></td></tr>` +
          `<tr><th scope="row" class="lbl">Counts held</th><td>${r.tables.length} kinds of count (criminal offenses, VAWA offenses, hate crimes, arrests, disciplinary referrals, unfounded crimes), each by on campus, residence halls, noncampus, public property and reported by local police. See <a href="/husky-explorer-census/campus.html">Campus crime</a>.</td></tr>` +
          `<tr><th scope="row" class="lbl">Credit and terms</th><td>${esc(r.terms)}${r.about.length ? `<br><strong>Read about it elsewhere:</strong> ${r.about.map(([label, url]) => `<a href="${esc(url)}" rel="noopener noreferrer">${esc(label)}</a>`).join(' · ')}` : ''}</td></tr></tbody></table>`,
      )
      .join('')
  })
  .catch(() => {})

el('filter').addEventListener('input', draw)
el('csv').addEventListener('click', () => {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([catalogCsv(rows)], { type: 'text/csv;charset=utf-8' })), download: 'husky-explorer-data-sources.csv' })
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
})
draw()
