// A table as an R script: the data typed into a data.frame with its labels and credits, so it runs in R (or RCraft) with
// nothing else to download. Missing values are NA, text is quoted, and each column carries its label as a "label" attribute.

const quote = (s) => `"${String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ')}"`
const comment = (s) => String(s ?? '').replace(/[\r\n]+/g, ' ')

/** A valid R name: letters, digits, dots and underscores, not starting with a digit. */
export function rName(raw, taken) {
  let n = String(raw).replace(/[^A-Za-z0-9_.]+/g, '_').replace(/^_+|_+$/g, '')
  if (!/^[A-Za-z.]/.test(n)) n = `x${n}`
  let name = n
  for (let i = 2; taken.has(name); i++) name = `${n}_${i}`
  taken.add(name)
  return name
}

/**
 * @param {{ name: string, label?: string, type: 'double' | 'text' }[]} columns
 * @param {(string | number | null)[][]} rows
 * @param {{ title?: string, notices?: string[], frame?: string }} [opts]
 */
export function toRScript(columns, rows, opts = {}) {
  const taken = new Set()
  const names = columns.map((c) => rName(c.name, taken))
  const frame = opts.frame ?? 'explorer'
  const out = []
  out.push(`# ${comment(opts.title ?? 'Husky Explorer table')}`)
  for (const n of opts.notices ?? []) out.push(`# ${comment(n)}`)
  out.push('# encoding: UTF-8', '')
  out.push(`${frame} <- data.frame(`)
  columns.forEach((c, i) => {
    const cells = rows.map((r) => {
      const v = r[i]
      if (c.type === 'text') return v === null || v === undefined ? 'NA' : quote(v)
      return typeof v === 'number' && Number.isFinite(v) ? String(v) : 'NA'
    })
    out.push(`  ${names[i]} = c(${cells.join(', ')})${i < columns.length - 1 ? ',' : ','}`)
  })
  out.push('  stringsAsFactors = FALSE', ')')
  columns.forEach((c, i) => {
    if (c.label) out.push(`attr(${frame}$${names[i]}, "label") <- ${quote(c.label)}`)
  })
  out.push('', `str(${frame})`)
  return out.join('\n') + '\n'
}
