import { degrees } from './temperature.js'
import { SITE } from './site.js'

/** False on a hosted copy built without margins of error (a site profile's dropMoe): nothing then shows or downloads one. */
export const SHOW_MOE = !SITE?.dropMoe

const MOE_SENTENCE = /[^.]*\bmargins? of error\b[^.]*\.\s*/gi
/** The text, without its sentences about margins of error when the site shows none. */
export function moeText(text, show = SHOW_MOE) {
  return show ? text : text.replace(MOE_SENTENCE, ' ').replace(/\s{2,}/g, ' ').trim()
}

/**
 * A download (rows of cells) for a site that shows no margins of error: the columns headed "margin of error" (or "Margin")
 * in the first rows are taken out, and so are sentences about margins in the text cells. Unchanged when the site shows them.
 * @param {unknown[][]} grid
 */
export function withoutMoe(grid, show = SHOW_MOE) {
  if (show) return grid
  const head = grid.slice(0, 5)
  const drop = new Set()
  for (const row of head) row.forEach((c, i) => typeof c === 'string' && /margin of error|^margin$/i.test(c) && drop.add(i))
  return grid
    .map((row) => (row.length > 1 ? row.filter((_, i) => !drop.has(i)) : row).map((c) => (typeof c === 'string' ? moeText(c, false) : c)))
    .filter((row) => row.length && !(row.length === 1 && row[0] === ''))
}

const count = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

/** @param {number | null | undefined} value @param {'count'|'dollars'|'percent'} unit */
export function formatValue(value, unit) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'no data'
  if (unit === 'percent') return value.toFixed(1) + '%'
  if (unit === 'dollars') return '$' + count.format(value)
  if (unit === 'years') return value.toFixed(1) + ' years'
  if (unit === 'ugm3') return value.toFixed(1) + ' µg/m³'
  if (unit === 'ppb') return value.toFixed(1) + ' ppb'
  if (unit === 'number') return number.format(value)
  if (unit === 'celsius') return degrees(value)
  if (unit === 'index') return value.toFixed(1)
  if (unit === 'per100') return value.toFixed(1) + ' per 100'
  if (unit === 'per1000') return value.toFixed(2) + ' per 1,000'
  if (unit === 'per100k') return count.format(Math.round(value)) + ' per 100,000'
  if (unit === 'days') return count.format(Math.round(value)) + (Math.round(value) === 1 ? ' day' : ' days')
  return count.format(value)
}

export function formatMoe(moe, unit) {
  if (!SHOW_MOE || moe === null || moe === undefined || Number.isNaN(moe)) return ''
  if (unit === 'percent') return '±' + moe.toFixed(1) + ' points'
  if (unit === 'dollars') return '±$' + count.format(moe)
  if (unit === 'years') return '±' + moe.toFixed(1) + ' years'
  if (unit === 'ugm3') return '±' + moe.toFixed(1) + ' µg/m³'
  if (unit === 'ppb') return '±' + moe.toFixed(1) + ' ppb'
  return '±' + count.format(moe)
}

/** Decimals that tell the class bounds apart. */
export function decimalsFor(unit) {
  return unit === 'count' || unit === 'dollars' || unit === 'days' ? 0 : unit === 'number' ? 2 : 1
}
