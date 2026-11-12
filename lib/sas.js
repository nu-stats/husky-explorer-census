// The comparison as a SAS program: one file that holds the data and reads it into a data set with
// variable labels, so it opens in SAS with nothing else to download. One row per place, an
// estimate column and a margin-of-error column (90 percent) per measure.

const ASCII = { '–': '-', '—': '-', '’': "'", '‘': "'", '“': "'", '”': "'", 'µ': 'u', '³': '3', '²': '2', '±': '+/-', 'é': 'e' }

/** Text SAS can hold in any encoding: plain ASCII, no double quotes, no comment end. */
export function asciiText(s) {
  return String(s)
    .replace(/[^\x20-\x7e]/g, (c) => ASCII[c] ?? '')
    .replaceAll('"', "'")
    .replaceAll('*/', '* /')
}

/**
 * SAS names: start with a letter or underscore, letters, digits and underscores, at most 32 long.
 * Returned unique across `taken`.
 */
export function sasName(base, taken) {
  let n = base.replace(/[^A-Za-z0-9_]/g, '_')
  if (!/^[A-Za-z_]/.test(n)) n = '_' + n
  n = n.slice(0, 28)
  let name = n
  for (let i = 2; taken.has(name.toLowerCase()); i++) name = n.slice(0, 26) + '_' + i
  taken.add(name.toLowerCase())
  return name
}

function cell(x) {
  return x === null || x === undefined ? '' : String(x)
}

/**
 * @param {{ geoid: string, name: string }[]} places
 * @param {{ measure: { id: string, label: string, unit: string }, values: { est: number | null, moe: number | null }[] }[]} rows
 * @param {string[]} [notices] credit lines, written as comments
 */
export function toSas(places, rows, notices = []) {
  const taken = new Set(['geoid', 'name'])
  const vars = rows.map((r) => {
    const base = sasName(r.measure.id, taken)
    const moe = sasName(base + '_moe', taken)
    return { est: base, moe, label: asciiText(r.measure.label), unit: r.measure.unit }
  })
  const out = []
  out.push('/* Husky Explorer: comparison of places. One row per place; for each measure an estimate and its margin of error at the 90 percent confidence level. */')
  for (const n of notices) out.push(`/* ${asciiText(n)} */`)
  out.push('data work.compare;')
  out.push('  infile datalines dsd truncover;')
  out.push(`  input geoid :$12. name :$120.${vars.map((v) => ` ${v.est} ${v.moe}`).join('')};`)
  out.push('  label geoid="GEOID" name="Place"')
  for (const v of vars) {
    out.push(`    ${v.est}="${v.label} (${v.unit}), estimate"`)
    out.push(`    ${v.moe}="${v.label}, margin of error (90%)"`)
  }
  out.push('  ;')
  out.push('datalines;')
  places.forEach((p, i) => {
    const cells = [p.geoid, `"${asciiText(p.name)}"`]
    for (const r of rows) cells.push(cell(r.values[i].est), cell(r.values[i].moe))
    out.push(cells.join(','))
  })
  out.push(';')
  out.push('run;')
  out.push('')
  out.push('proc print data=work.compare label noobs; run;')
  return out.join('\r\n') + '\r\n'
}
