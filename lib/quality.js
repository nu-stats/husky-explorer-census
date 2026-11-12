// A screen for thin reporting: how much a police department sent the FBI compared with the typical place in its state.
// It is a screen, not a verdict: a place can send little because little happened, or because its records system was in transition.

/** A department below this share of its state's median incidents per 1,000 residents is flagged. */
export const LOW_SHARE = 0.25

export function median(values) {
  const xs = values.filter((v) => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b)
  if (!xs.length) return null
  const mid = Math.floor(xs.length / 2)
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2
}

/**
 * @param {number | null | undefined} value incidents per 1,000 residents of the place
 * @param {(number | null)[]} peers the same figure for the other places in the state
 * @returns {{ median: number, ratio: number, low: boolean } | null} null when there is too little to compare with
 */
export function reportingScreen(value, peers) {
  const usable = peers.filter((v) => typeof v === 'number' && Number.isFinite(v) && v > 0)
  if (typeof value !== 'number' || !Number.isFinite(value) || usable.length < 10) return null
  const m = median(usable)
  if (!m) return null
  return { median: m, ratio: value / m, low: value / m < LOW_SHARE }
}

/** The sentence for a profile page. `months` is how many months of the year the department submitted. */
export function reportingSentence(value, months, screen, year) {
  if (value === null || value === undefined) return `No incident-based reporting figure for this place in ${year}: the department may report in the older summary system, or it could not be matched by name.`
  const base = `Reporting check (FBI incident-based data, ${year}): this department sent ${value.toFixed(1)} incidents per 1,000 residents${months === null || months === undefined ? '' : ` in ${months} of 12 months`}`
  if (!screen) return `${base}. Too few places in the state to compare with.`
  const peer = `; the median place in the state sent ${screen.median.toFixed(1)}`
  return screen.low
    ? `${base}${peer}. That is under a quarter of the median: the crime numbers for this place are probably incomplete, which would make them look low. (A screen, not a verdict.)`
    : `${base}${peer}. Nothing here suggests thin reporting, by this rough screen.`
}
