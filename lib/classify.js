// Dividing numbers into classes for a choropleth. Natural breaks is the Fisher
// (1958) / Jenks (1967) optimal grouping found exactly by dynamic programming;
// quantile and equal interval follow their textbook definitions. Ported from
// MapCraft's symbology/classify (same authors, same licenses).

/** @typedef {{ min: number, breaks: number[], note?: string }} Classes */

/** Above this many distinct values, natural breaks works on an evenly spaced sample. */
export const JENKS_SAMPLE = 4000

/**
 * @param {number[]} values
 * @param {'natural-breaks' | 'quantile' | 'equal-interval'} method
 * @param {number} k
 * @returns {Classes}
 */
export function classify(values, method, k) {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (!sorted.length) throw new Error('There are no numbers to classify.')
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  k = Math.max(1, Math.floor(k))
  if (min === max) return { min, breaks: [max], note: 'Every value is the same, so there is one class.' }
  if (method === 'equal-interval') {
    const width = (max - min) / k
    return { min, breaks: Array.from({ length: k }, (_, i) => (i === k - 1 ? max : min + width * (i + 1))) }
  }
  if (method === 'quantile') return quantile(sorted, k)
  return naturalBreaks(sorted, k)
}

function distinct(sorted) {
  const v = []
  const w = []
  for (const x of sorted) {
    if (v.length && v[v.length - 1] === x) w[w.length - 1]++
    else {
      v.push(x)
      w.push(1)
    }
  }
  return { v, w }
}

function fewerDistinct(v, k) {
  return { min: v[0], breaks: [...v], note: `There are only ${v.length} different values, so each gets its own class (${k} were asked for).` }
}

function quantile(sorted, k) {
  const { v } = distinct(sorted)
  if (v.length <= k) return fewerDistinct(v, k)
  const n = sorted.length
  const breaks = []
  for (let i = 1; i < k; i++) {
    const b = sorted[Math.ceil((i * n) / k) - 1]
    if (!breaks.length || b > breaks[breaks.length - 1]) breaks.push(b)
  }
  const max = sorted[n - 1]
  if (!breaks.length || breaks[breaks.length - 1] < max) breaks.push(max)
  const out = { min: sorted[0], breaks }
  if (breaks.length < k) out.note = `Repeated values made some quantile classes the same, so there are ${breaks.length} classes instead of ${k}.`
  return out
}

function naturalBreaks(sorted, k) {
  let note
  let data = sorted
  let { v, w } = distinct(data)
  if (v.length <= k) return fewerDistinct(v, k)
  if (v.length > JENKS_SAMPLE) {
    const n = sorted.length
    data = Array.from({ length: JENKS_SAMPLE }, (_, i) => sorted[Math.round((i * (n - 1)) / (JENKS_SAMPLE - 1))])
    ;({ v, w } = distinct(data))
    note = `Natural breaks were found from an evenly spaced sample of ${JENKS_SAMPLE.toLocaleString('en-US')} of the ${n.toLocaleString('en-US')} values.`
    if (v.length <= k) return { ...fewerDistinct(v, k), note }
  }
  const breaks = fisherJenks(v, w, k)
  breaks[breaks.length - 1] = sorted[sorted.length - 1]
  return note ? { min: sorted[0], breaks, note } : { min: sorted[0], breaks }
}

/**
 * Exact optimal classes of weighted, distinct, ascending values: the split into
 * k groups of consecutive values with the least total within-group sum of
 * squared deviations. Returns each group's largest value.
 */
export function fisherJenks(v, w, k) {
  const n = v.length
  const shift = v[0]
  const W = new Float64Array(n + 1)
  const S = new Float64Array(n + 1)
  const Q = new Float64Array(n + 1)
  for (let i = 0; i < n; i++) {
    const x = v[i] - shift
    W[i + 1] = W[i] + w[i]
    S[i + 1] = S[i] + w[i] * x
    Q[i + 1] = Q[i] + w[i] * x * x
  }
  const ssd = (i, j) => {
    const ww = W[j + 1] - W[i]
    const s = S[j + 1] - S[i]
    return Math.max(0, Q[j + 1] - Q[i] - (s * s) / ww)
  }
  const cost = [Float64Array.from({ length: n }, (_, j) => ssd(0, j))]
  const from = [new Int32Array(n)]
  for (let c = 1; c < k; c++) {
    const prev = cost[c - 1]
    const cur = new Float64Array(n).fill(Infinity)
    const arg = new Int32Array(n)
    for (let j = c; j < n; j++) {
      let best = Infinity
      let bi = c
      for (let i = j; i >= c; i--) {
        const t = prev[i - 1] + ssd(i, j)
        if (t < best) {
          best = t
          bi = i
        }
      }
      cur[j] = best
      arg[j] = bi
    }
    cost.push(cur)
    from.push(arg)
  }
  const breaks = new Array(k)
  let j = n - 1
  for (let c = k - 1; c >= 0; c--) {
    breaks[c] = v[j]
    j = c === 0 ? -1 : from[c][j] - 1
  }
  return breaks
}

/** The class a value falls in: the first whose upper bound is at least the value. NaN gives -1. */
export function classIndex(value, min, breaks) {
  if (Number.isNaN(value) || !breaks.length) return -1
  if (value <= min) return 0
  let lo = 0
  let hi = breaks.length - 1
  if (value > breaks[hi]) return hi
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (value <= breaks[mid]) hi = mid
    else lo = mid + 1
  }
  return lo
}

/** Legend labels such as "1.0 – 5.0", "5.1 – 9.0". */
export function breakLabels(min, breaks, decimals, prefix = '', suffix = '') {
  const fmt = (x) => prefix + x.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix
  const step = 10 ** -decimals
  return breaks.map((upper, i) => {
    if (i === 0) return `${fmt(min)} – ${fmt(upper)}`
    const prev = breaks[i - 1]
    const lowerShown = Number(prev.toFixed(decimals)) + step
    return `${fmt(lowerShown > upper ? prev : lowerShown)} – ${fmt(upper)}`
  })
}

/**
 * The 2nd and 98th percentile (by default) of some values: the range to compute class
 * breaks over when a few extreme values would otherwise stretch every class. Values
 * outside it still fall in the end classes; nothing is dropped from the map.
 * @param {number[]} values
 * @param {number} share the share cut from each end
 * @returns {[number, number]}
 */
export function clipRange(values, share = 0.02) {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (!sorted.length) throw new Error('There are no numbers to clip.')
  const lo = sorted[Math.floor(sorted.length * share)]
  const hi = sorted[Math.max(0, Math.ceil(sorted.length * (1 - share)) - 1)]
  return [lo, hi]
}
