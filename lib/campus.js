import { esc } from './chart.js'
import { SHOW_MOE } from './format.js'

// The campus crime page's logic: search, institution totals, the change from the earliest to the latest year, and rates.
// Pure functions over the files the build wrote (data/build/campus/index.json and inst/<id>.json); nothing here touches the page.
//
// What these numbers are: crimes reported to campus officials and police (Clery Act), counted by each school. They are not
// a sample, so there are no standard errors, and not victimization, so schools are not comparable (see CAMPUS_CAUTIONS).

/** A percent change is not shown when the earlier count is below this: one or two reports would swing it. */
export const MIN_FOR_PERCENT = 10

export const PLACE_ORDER = ['on', 'res', 'non', 'pub', 'rep']

/** Lower case, accents and punctuation removed, so "St. Mary's" finds "st marys". */
export function normalize(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Institutions matching what was typed, best first: every typed word must start a word of the name, alias, city or state.
 * A name that starts with the whole query ranks first, then a whole word match, then the rest, then shorter names.
 * @param {{ n: string, a?: string, c?: string, s?: string, nc?: number }[]} rows the index
 */
export function searchInstitutions(rows, query, limit = 25) {
  const words = normalize(query).split(' ').filter(Boolean)
  if (!words.length) return []
  const scored = []
  for (const r of rows) {
    const name = normalize(r.n)
    const hay = [name, normalize(r.a), normalize(r.c), normalize(r.s)].join(' ').split(' ')
    // "marys" finds "Mary's": a query run together is also tried against the name with its spaces taken out.
    const together = name.replace(/ /g, '').startsWith(words.join(''))
    if (!together && !words.every((w) => hay.some((h) => h.startsWith(w)))) continue
    let score = 0
    if (name.startsWith(words.join(' '))) score += 4
    if (words.every((w) => name.split(' ').includes(w))) score += 2
    if (words.some((w) => normalize(r.s) === w)) score += 1
    scored.push({ r, score, campuses: r.nc ?? 0, len: name.length })
  }
  // Among equal matches, a school with more campuses first (the bigger name people most likely mean), then the shorter name.
  scored.sort((a, b) => b.score - a.score || b.campuses - a.campuses || a.len - b.len || a.r.n.localeCompare(b.r.n))
  return scored.slice(0, limit).map((x) => x.r)
}

/**
 * The institution's series for one place and category: the campuses added up year by year. A year is null only when every
 * campus has no figure for it; a campus with no figure adds nothing (it is not a zero). `years` is [first, last].
 * @returns {(number | null)[]} one value per calendar year from years[0]
 */
export function institutionSeries(inst, place, cat, years) {
  const span = years[1] - years[0] + 1
  const out = new Array(span).fill(null)
  for (const c of inst.campuses) {
    const arr = c.s?.[place]?.[cat]
    if (!arr) continue
    for (let i = 0; i < span; i++) {
      const v = arr[i]
      if (v !== null && v !== undefined) out[i] = (out[i] ?? 0) + v
    }
  }
  return out
}

/** Whether any campus has any figure for this place and category. */
export function hasSeries(inst, place, cat) {
  return inst.campuses.some((c) => c.s?.[place]?.[cat])
}

/** Calendar years with a figure for at least one category of the institution, from its file. */
export function yearsHeld(inst) {
  return inst.years ?? null
}

/** The institution's enrollment for a calendar year (one figure for the whole institution), or null. */
export function enrollmentFor(inst, year) {
  const e = inst.enrollment?.[String(year)]
  return e && e.total ? e : null
}

/** Reports per 1,000 students, or null without an enrollment. A count of 0 is a rate of 0. */
export function perThousand(count, enrollment) {
  if (count === null || count === undefined || !enrollment || enrollment <= 0) return null
  return (1000 * count) / enrollment
}

/** The earliest and latest year in a series that have a figure, or null when there are none. */
export function firstAndLast(series, from) {
  let first = -1
  let last = -1
  series.forEach((v, i) => {
    if (v !== null) {
      if (first < 0) first = i
      last = i
    }
  })
  return first < 0 ? null : { first: { year: from + first, value: series[first] }, last: { year: from + last, value: series[last] } }
}

/**
 * The change from the earliest year with a figure to the latest, for one series. `earliest` and `latest` are the year the
 * institution has data for at all; a series that starts later (a category added in 2014) says so rather than reaching back.
 * A percent change is given only when the earlier count is at least MIN_FOR_PERCENT.
 * @returns {null | { from: {year:number,value:number}, to: {year:number,value:number}, diff: number, percent: number | null,
 *   reason: string, startsLate: boolean, endsEarly: boolean, rateFrom: number | null, rateTo: number | null }}
 */
export function changeOver(series, from, earliest, latest, enrollmentAt) {
  const fl = firstAndLast(series, from)
  if (!fl || fl.first.year === fl.last.year) return null
  const a = fl.first.value
  const b = fl.last.value
  let percent = null
  let reason = ''
  if (a < MIN_FOR_PERCENT) reason = `the earlier count (${a}) is under ${MIN_FOR_PERCENT}, so a percent would mislead`
  else percent = (100 * (b - a)) / a
  return {
    from: fl.first,
    to: fl.last,
    diff: b - a,
    percent,
    reason,
    startsLate: fl.first.year > earliest,
    endsEarly: fl.last.year < latest,
    rateFrom: perThousand(a, enrollmentAt(fl.first.year)?.total),
    rateTo: perThousand(b, enrollmentAt(fl.last.year)?.total),
  }
}

/**
 * The summary table for one calendar year: for every category the institution has any figure for, the value in each place.
 * Rows come grouped in the order of `categories` (from the index). Residence halls are a part of on campus, never added.
 */
export function tableForYear(inst, categories, year, years, places = PLACE_ORDER) {
  const at = year - years[0]
  const rows = []
  for (const cat of categories) {
    const values = {}
    let any = false
    for (const p of places) {
      if (!hasSeries(inst, p, cat.id)) {
        values[p] = undefined
        continue
      }
      any = true
      values[p] = institutionSeries(inst, p, cat.id, years)[at] ?? null
    }
    if (any) rows.push({ id: cat.id, label: cat.label, group: cat.group, note: cat.note ?? '', values })
  }
  return rows
}

/** Groups table rows by their group, keeping the order. */
export function grouped(rows) {
  const out = []
  for (const r of rows) {
    const last = out[out.length - 1]
    if (last && last.group === r.group) last.rows.push(r)
    else out.push({ group: r.group, rows: [r] })
  }
  return out
}

/** The text of one change, in plain words. */
export function describeChange(ch) {
  if (!ch) return 'Only one year has a figure.'
  const sign = ch.diff > 0 ? `up ${ch.diff}` : ch.diff < 0 ? `down ${-ch.diff}` : 'no change'
  const pct = ch.percent === null ? '' : ` (${ch.percent > 0 ? '+' : ''}${ch.percent.toFixed(0)}%)`
  return `${ch.from.value} reported in ${ch.from.year}, ${ch.to.value} in ${ch.to.year}: ${sign}${pct}`
}

/** Printed beside the table, with the numbers they qualify. */
export const CAMPUS_CAUTIONS = [
  ['These are reports, not all crime', 'A count is an offense reported to campus officials or police in a defined place and year. Surveys of students and others find that many sexual assaults and other crimes are never reported, so a low count can mean few reports. Compare with the national victimization tables on the data sources page (they cover ages 12 and up, not only students).'],
  ['A rise can mean more reporting', 'More reporting can follow better services, more trust or new rules. The counts cannot tell these apart from more crime.'],
  ['Schools are not comparable', 'What gets reported depends on how a school defines its campus, its housing, the police around it and its culture of reporting. This page does not rank or sort schools by crime, and you should not either.'],
  ['Small counts swing', `A change from 1 to 3 is a tripling on two reports. A percent change is not shown when the earlier count is under ${MIN_FOR_PERCENT}.`],
  ['Zero and blank are different', '“0” means the school reported none. “–” means no figure for that year, and the reason is not stated in the files. Do not read either as “no crime”.'],
  ['Definitions changed', 'Sex offenses were “forcible” and “nonforcible” through 2013 and are rape, fondling, incest and statutory rape from 2014. VAWA offenses, unfounded crimes and hate-crime detail were added later. A change across a break is not a like-for-like change, so the page begins each category at its first year.'],
  ['Residence halls are inside “on campus”', 'Never add them. Hate crimes are shown beside criminal offenses, not added to them.'],
  ['Rates use one enrollment figure', 'The enrollment in each report is for the whole institution (undergraduate and graduate, from IPEDS), not for a campus and not for the people present. Rates are therefore shown for the institution only.'],
  ['No margin of error', 'This is a count from nearly every participating school, not a sample, so there is no sampling error and no weights. That does not mean the counts are exact: schools count differently and can correct earlier years later.'],
  ['Schools change', 'A school that closed, merged or changed its id has a shorter or separate series, and campuses abroad are left out of these totals (the Department of Education’s own screens include them).'],
].filter(([title]) => SHOW_MOE || title !== 'No margin of error')

/** The break between the old and new sex offense categories sits between these calendar years. */
export const SEX_OFFENSE_BREAK = [2013, 2014]
export const SEX_OFFENSE_IDS = ['c_forcib', 'c_nonfor', 'c_rape', 'c_fondl', 'c_inces', 'c_statr']

/**
 * The institution's figures as a CSV, one row per place, category and year, with the cautions at the top as comment lines
 * so they travel with the file. A blank count is "no figure"; a 0 is "reported none".
 */
export function institutionCsv(inst, categories, years, placeLabels, notice) {
  const cell = (x) => (/[",\n\r]/.test(String(x)) ? `"${String(x).replaceAll('"', '""')}"` : String(x))
  const lines = [
    ...notice.map((l) => `# ${l}`),
    `# ${inst.name}, ${inst.city}, ${inst.state} (IPEDS unit id ${inst.id}). Totals add the U.S. campuses.`,
    ['place', 'group', 'category', 'year', 'reports', 'enrollment', 'reports_per_1000_students'].join(','),
  ]
  for (const place of PLACE_ORDER) {
    for (const cat of categories) {
      if (!hasSeries(inst, place, cat.id)) continue
      const series = institutionSeries(inst, place, cat.id, years)
      series.forEach((v, i) => {
        const year = years[0] + i
        const e = enrollmentFor(inst, year)
        const rate = perThousand(v, e?.total)
        lines.push([placeLabels[place] ?? place, cat.group, cat.label, year, v ?? '', e?.total ?? '', rate === null ? '' : rate.toFixed(3)].map(cell).join(','))
      })
    }
  }
  return lines.join('\r\n') + '\r\n'
}

/** Whether two calendar years lie on either side of the 2013/2014 change in the sex offense categories. */
export function crossesBreak(catId, yearA, yearB) {
  if (!SEX_OFFENSE_IDS.includes(catId)) return false
  const [lo, hi] = yearA <= yearB ? [yearA, yearB] : [yearB, yearA]
  return lo <= SEX_OFFENSE_BREAK[0] && hi >= SEX_OFFENSE_BREAK[1]
}

/**
 * One series at two years chosen by the person. Either year may have no figure (a blank, not a zero): then no change is given.
 * A percent change is given only when the earlier year's count is at least MIN_FOR_PERCENT. The years are put in time order.
 * @returns {{ a: {year:number,value:number|null}, b: {year:number,value:number|null}, diff: number|null, percent: number|null, reason: string, rateA: number|null, rateB: number|null }}
 */
export function changeBetween(series, from, yearA, yearB, enrollmentAt) {
  const [ya, yb] = yearA <= yearB ? [yearA, yearB] : [yearB, yearA]
  const at = (y) => series[y - from] ?? null
  const a = at(ya)
  const b = at(yb)
  let percent = null
  let reason = ''
  if (a === null || b === null) reason = `no figure for ${a === null && b === null ? `${ya} or ${yb}` : a === null ? ya : yb}`
  else if (a < MIN_FOR_PERCENT) reason = `the earlier count (${a}) is under ${MIN_FOR_PERCENT}, so a percent would mislead`
  else percent = (100 * (b - a)) / a
  return {
    a: { year: ya, value: a },
    b: { year: yb, value: b },
    diff: a === null || b === null ? null : b - a,
    percent,
    reason,
    rateA: perThousand(a, enrollmentAt(ya)?.total),
    rateB: perThousand(b, enrollmentAt(yb)?.total),
  }
}

/** Every category with a figure in this place, compared between two years: [{ cat, ch, breaks }]. A category with no figure in either year is left out. */
export function compareYears(inst, categories, place, years, yearA, yearB) {
  const rows = []
  for (const cat of categories) {
    if (!hasSeries(inst, place, cat.id)) continue
    const ch = changeBetween(institutionSeries(inst, place, cat.id, years), years[0], yearA, yearB, (y) => enrollmentFor(inst, y))
    if (ch.a.value === null && ch.b.value === null) continue
    rows.push({ cat, ch, breaks: crossesBreak(cat.id, yearA, yearB) })
  }
  return rows
}

/** The two-year comparison as CSV with the notice as comment lines; a blank is no figure, a 0 is reported none. */
export function comparisonCsv(inst, placeLabel, rows, notice) {
  const cell = (x) => (/[",\n\r]/.test(String(x)) ? `"${String(x).replaceAll('"', '""')}"` : String(x))
  const first = rows[0]?.ch
  const ya = first?.a.year ?? ''
  const yb = first?.b.year ?? ''
  const lines = [
    ...notice.map((l) => `# ${l}`),
    `# ${inst.name}, ${inst.city}, ${inst.state} (IPEDS unit id ${inst.id}), ${placeLabel}. Totals add the U.S. campuses.`,
    ['group', 'category', `reports_${ya}`, `reports_${yb}`, 'change', 'percent_change', `per_1000_${ya}`, `per_1000_${yb}`, 'note'].join(','),
  ]
  for (const { cat, ch, breaks } of rows) {
    const note = [ch.reason, breaks ? 'the definition of this category changed between these years' : ''].filter(Boolean).join('; ')
    lines.push([cat.group, cat.label, ch.a.value ?? '', ch.b.value ?? '', ch.diff ?? '', ch.percent === null ? '' : ch.percent.toFixed(1), ch.rateA === null ? '' : ch.rateA.toFixed(3), ch.rateB === null ? '' : ch.rateB.toFixed(3), note].map(cell).join(','))
  }
  return lines.join('\r\n') + '\r\n'
}

/** A kind of crime's label for a chart: outside the criminal offenses the group is named, since "Drug law violations" appears under arrests, referrals and more. */
function chartLabel(cat) {
  const text = cat.group && cat.group !== 'Criminal offenses' ? `${cat.group.replace(/^Arrests?/, 'Arrests').replace(/^Disciplinary referrals?/, 'Referrals')}: ${cat.label}` : cat.label
  return text.length > 46 ? text.slice(0, 45) + '…' : text
}

const A_COLOR = '#1f77b4'
const B_COLOR = '#c8102e'

/**
 * A bar chart of the two-year comparison as a standalone SVG (real colors and fonts, so it works as a downloaded image):
 * a pair of bars per kind of crime, with the school, places, the unit and the caution written in the picture itself.
 * Kinds with no report in either year are left out (and counted in the footer); a year with no figure shows "no figure", not a bar.
 * @param {{ cat: {label:string}, ch: ReturnType<typeof changeBetween> }[]} rows from compareYears
 * @param {{ school: string, place: string, rate?: boolean }} opts rate: reports per 1,000 students rather than counts
 */
export function comparisonSvg(rows, { school, place, rate = false }) {
  const pick = (ch, which) => (rate ? (which === 'a' ? ch.rateA : ch.rateB) : which === 'a' ? ch.a.value : ch.b.value)
  const shown = rows.filter((r) => (pick(r.ch, 'a') ?? 0) > 0 || (pick(r.ch, 'b') ?? 0) > 0)
  const left = rows.length - shown.length
  const ya = rows[0]?.ch.a.year
  const yb = rows[0]?.ch.b.year
  const W = 820
  const labelW = 300
  const rowH = 36
  const top = 70
  const H = top + shown.length * rowH + 84
  const all = shown.flatMap((r) => [pick(r.ch, 'a'), pick(r.ch, 'b')]).filter((v) => v !== null)
  const max = Math.max(1, ...all)
  const plotW = W - labelW - 70
  const fmt = (v) => (rate ? (v < 10 ? v.toFixed(2) : v.toFixed(1)) : v.toLocaleString('en-US'))
  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Arial, Helvetica, sans-serif" font-size="12">`,
    `<rect width="${W}" height="${H}" fill="#ffffff"/>`,
    `<text x="14" y="22" font-size="15" font-weight="bold" fill="#1c2430">${esc(school)}: ${esc(place)}, ${ya} and ${yb}</text>`,
    `<text x="14" y="40" fill="#555">${rate ? 'Reports per 1,000 students' : 'Crimes reported to campus officials and police'}, as the school counted them</text>`,
    `<rect x="14" y="48" width="10" height="10" fill="${A_COLOR}"/><text x="28" y="57" fill="#1c2430">${ya}</text><rect x="74" y="48" width="10" height="10" fill="${B_COLOR}"/><text x="88" y="57" fill="#1c2430">${yb}</text>`,
  ]
  shown.forEach((r, i) => {
    const y = top + i * rowH
    out.push(`<text x="${labelW - 8}" y="${y + 20}" text-anchor="end" fill="#1c2430">${esc(chartLabel(r.cat))}</text>`)
    for (const [k, which, color] of [[0, 'a', A_COLOR], [1, 'b', B_COLOR]]) {
      const v = pick(r.ch, which)
      const by = y + 6 + k * 14
      if (v === null) out.push(`<text x="${labelW}" y="${by + 10}" fill="#777" font-style="italic">no figure</text>`)
      else out.push(`<rect x="${labelW}" y="${by}" width="${Math.max(1, (v / max) * plotW).toFixed(1)}" height="12" fill="${color}"/><text x="${labelW + Math.max(1, (v / max) * plotW) + 5}" y="${by + 10}" fill="#1c2430">${fmt(v)}</text>`)
    }
  })
  out.push(`<line x1="${labelW}" x2="${labelW}" y1="${top}" y2="${top + shown.length * rowH}" stroke="#999"/>`)
  const fy = top + shown.length * rowH + 20
  out.push(
    `<text x="14" y="${fy}" fill="#555">${left ? `${left} other kind${left === 1 ? '' : 's'} of crime had no reports in either year. ` : ''}A blank year is no figure, not zero.</text>`,
    `<text x="14" y="${fy + 16}" fill="#555">Reports are not all crime, and schools are not comparable.</text>`,
    `<text x="14" y="${fy + 32}" fill="#555">Source: U.S. Dept. of Education, Campus Safety and Security data (Clery Act); enrollment from IPEDS. Husky Explorer.</text>`,
    '</svg>',
  )
  return out.join('')
}
