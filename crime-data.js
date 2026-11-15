// The "Using crime data" page: the common warning and the reading behind it.
import { esc } from './lib/chart.js'
import { BACKGROUND, CRIME_WARNING, KNOWN_ISSUES, LIMITS, USED_IN } from './lib/crime-notice.js'

const el = (id) => document.getElementById(id)
const link = (url, text) => `<a href="${esc(url)}" rel="noopener noreferrer">${esc(text)}</a>`

el('warning').innerHTML = CRIME_WARNING.map((t) => `<li>${esc(t)}</li>`).join('')
el('issues').innerHTML = KNOWN_ISSUES.map((i) => `<li><b>${esc(i.title)}.</b> ${esc(i.text)}</li>`).join('')
el('limits').innerHTML = LIMITS.map((r) => `<li>${link(r.url, r.cite)}<br><span class="note">${esc(r.finding)}</span></li>`).join('')
el('used').innerHTML = USED_IN.map((r) => `<li>${link(r.url, r.cite)}<br><span class="note">${esc(r.note)}</span></li>`).join('')
el('background').innerHTML = BACKGROUND.map(([t, u]) => `<li>${link(u, t)}</li>`).join('')
