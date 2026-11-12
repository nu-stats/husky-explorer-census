// Formatting for the Survey data page's ATUS table, kept apart from the page so it can be tested in Node.

/** One cell: hours with the standard error in brackets, hours alone when there is no standard error, blank when there is no value. */
export function atusCell(hours, se) {
  if (hours === null || hours === undefined) return ''
  return se === null || se === undefined ? hours.toFixed(2) : `${hours.toFixed(2)} (${se.toFixed(2)})`
}

/** Decimal hours as hours and minutes, for the hover text: 9.34 is "9 hours 20 minutes a day". */
export function hoursMinutes(hours) {
  if (hours === null || hours === undefined) return ''
  const total = Math.round(hours * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  const part = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'}`
  return `${h ? part(h, 'hour') : ''}${h && m ? ' ' : ''}${m || !h ? part(m, 'minute') : ''} a day`
}

const cell = (s) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)

/**
 * One activity as CSV, one row per group and year. A greyed-out year keeps its row, with blank values and the reason, so
 * the file says why it is empty.
 */
export function atusTableCsv(data, item) {
  const greyed = new Map((data.greyed ?? []).map((g) => [g.year, g.why]))
  // The unit is in the column names (hours per day, not a proportion), so the file says it without the page.
  const lines = [['activity', 'group', 'label', 'year', 'hours_per_day', 'se_hours', 'respondents', 'note'].join(',')]
  for (const r of item.rows)
    data.years.forEach((y, i) => {
      const off = greyed.get(y)
      const v = (x) => (off || x === null || x === undefined ? '' : String(x))
      lines.push([item.code, r.group, r.label, String(y), v(r.hours[i]), v(r.se[i]), v(r.respondents[i]), off ?? ''].map(cell).join(','))
    })
  return lines.join('\n') + '\n'
}
