// A report card for one police department, from public data only: what it sent the FBI's incident-based system each year, how that
// compares with the other departments in its state, what the FBI published for it, and a short list of things worth asking about.
// Every line is a screen, not a verdict: a department can send little because little happened, or because its records system changed.
import { LOW_SHARE, reportingScreen } from './quality.js'

/** A year-on-year change in incidents per 1,000 residents bigger than this is worth a question (it is often a records-system change). */
export const BIG_CHANGE = 0.4

const RANK = { ok: 0, check: 1, partial: 2, none: 3 }
const yearsOf = (table, prefix) => (table ? table.file.variables.filter((v) => v.startsWith(prefix + '_')).map((v) => Number(v.slice(prefix.length + 1))) : [])

/**
 * @param {{file:{variables:string[],rows:Record<string,any>},cell:(g:string,v:string)=>number|null,name:(g:string)=>string,has:(g:string)=>boolean}|null} nr the incident-based reporting table of the state
 * @param {typeof nr} cr the published Crime in the United States table of the state
 * @param {string} geoid the agency's id in `nr`
 * @param {{ peerIds?: string[], crGeoid?: string | null }} [options] `peerIds`: the departments to compare with (default: all in `nr`; for a
 *   sheriff or a metropolitan department pass the agencies of the same type). `crGeoid`: the id in `cr`, when it differs from `geoid`.
 */
export function agencyReport(nr, cr, geoid, options = {}) {
  const crId = options.crGeoid === undefined ? geoid : options.crGeoid
  const years = [...new Set([...yearsOf(nr, 'MON'), ...yearsOf(cr, 'POP')])].sort((a, b) => a - b)
  const name = nr?.has(geoid) ? nr.name(geoid) : crId && cr?.has(crId) ? cr.name(crId) : geoid
  const has = nr?.has(geoid) ?? false
  const rows = []
  let previous = null
  for (const year of years) {
    const months = has ? nr.cell(geoid, `MON_${year}`) : null
    const monthsWithIncidents = has ? nr.cell(geoid, `MINC_${year}`) : null
    const incidents = has ? nr.cell(geoid, `INC_${year}`) : null
    const perThousand = has ? nr.cell(geoid, `IPK_${year}`) : null
    const peerIds = options.peerIds ?? (nr ? Object.keys(nr.file.rows) : [])
    const peers = nr ? peerIds.filter((g) => g !== geoid).map((g) => nr.cell(g, `IPK_${year}`)) : []
    const screen = reportingScreen(perThousand, peers)
    const pub = (v) => (crId && cr ? cr.cell(crId, `${v}_${year}`) : null)
    const published = { population: pub('POP'), violent: pub('VC'), property: pub('PC'), violentRate: pub('VR'), propertyRate: pub('PR') }
    const notes = []
    let status = 'ok'
    const raise = (s) => {
      if (RANK[s] > RANK[status]) status = s
    }
    if (!months) {
      notes.push(
        published.violent !== null
          ? 'No incident-based submission found for this year, though the FBI published counts for it: the department probably reports in the older summary system, or its name could not be matched.'
          : 'No incident-based submission found for this year.',
      )
      raise('none')
    } else {
      if (months < 12) {
        notes.push(`Sent ${months} of 12 months. Counts built from this year cover only those months, so they read low.`)
        raise('partial')
      }
      if (monthsWithIncidents !== null && monthsWithIncidents < months) {
        notes.push(`Submitted ${months} months but reported incidents in only ${monthsWithIncidents}. A month with a submission can still be empty.`)
        raise('check')
      }
      if (screen?.low) {
        notes.push(`Sent ${perThousand.toFixed(1)} incidents per 1,000 residents, under a quarter of the state median of ${screen.median.toFixed(1)}. The numbers are probably incomplete.`)
        raise('check')
      }
      if (previous && previous.perThousand > 0 && perThousand !== null && previous.months === 12 && months === 12) {
        const change = (perThousand - previous.perThousand) / previous.perThousand
        if (Math.abs(change) > BIG_CHANGE) {
          notes.push(`Incidents per 1,000 residents ${change > 0 ? 'rose' : 'fell'} ${Math.round(Math.abs(change) * 100)}% from ${previous.year}. A change this big is more often a records-system or reporting change than a change in crime: ask.`)
          raise('check')
        }
      }
    }
    rows.push({ year, months, monthsWithIncidents, incidents, perThousand, median: screen?.median ?? null, ratio: screen?.ratio ?? null, low: screen?.low ?? false, published, status, notes })
    if (months) previous = { year, months, perThousand }
  }
  return { geoid, name, rows, todo: todoList(rows), lowShare: LOW_SHARE }
}

/** The questions to ask, once each, with the years they apply to. */
function todoList(rows) {
  const span = (ys) => (ys.length === 1 ? String(ys[0]) : `${ys[0]}–${ys[ys.length - 1]}`)
  const years = (s) => rows.filter((r) => r.status === s).map((r) => r.year)
  const out = []
  const none = years('none')
  const partial = years('partial')
  const check = years('check')
  if (none.length) out.push(`Years with no incident-based data (${span(none)}): confirm whether the department reports in the summary system or has not yet been certified for NIBRS through the state program.`)
  if (partial.length) out.push(`Years with fewer than 12 months (${span(partial)}): ask the state program which months are missing and whether the records system was down or being replaced.`)
  if (check.length) out.push(`Years that look thin or changed sharply (${span(check)}): compare incident counts with the department's own records, and run the submitted file through the file checker.`)
  if (!out.length && rows.some((r) => r.months)) out.push("Nothing in the public numbers stands out. That does not prove the file is complete; run the department's own file through the checker before each submission.")
  return out
}

/** The report as CSV, one row per year. */
export function reportCsv(report) {
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`
  const head = ['agency', 'year', 'months_submitted', 'months_with_incidents', 'incidents', 'incidents_per_1000', 'state_median_per_1000', 'published_violent', 'published_property', 'status', 'notes']
  const rows = report.rows.map((r) => [report.name, r.year, r.months, r.monthsWithIncidents, r.incidents, r.perThousand, r.median === null ? '' : r.median.toFixed(1), r.published.violent, r.published.property, r.status, r.notes.join(' ')].map(q).join(','))
  return [head.join(','), ...rows].join('\r\n') + '\r\n'
}
