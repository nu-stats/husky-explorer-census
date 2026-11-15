// Temperatures are stored in °C and shown in °F unless the person chooses °C (kept in this browser only).

const KEY = 'husky-explorer-temperature'

/** @returns {'F' | 'C'} */
export function scale() {
  try {
    return localStorage.getItem(KEY) === 'C' ? 'C' : 'F'
  } catch {
    return 'F'
  }
}

export function setScale(s) {
  try {
    localStorage.setItem(KEY, s === 'C' ? 'C' : 'F')
  } catch {
    // Storage is blocked: the choice lasts until the page is reloaded.
  }
}

export const toF = (c) => (c * 9) / 5 + 32

/** A °C value in the chosen scale (null stays null). */
export const inUnits = (c, s = scale()) => (c === null || c === undefined ? c : s === 'F' ? toF(c) : c)

/** "31.7 °C" or "89.1 °F". */
export const degrees = (c, s = scale(), digits = 1) => `${inUnits(c, s).toFixed(digits)} °${s}`

/**
 * Text written with °C, said in the chosen scale. In °F, each "24 °C" becomes "75 °F (24 °C)", "(°C)"
 * becomes "(°F)", and a pair already written as "95 °F (35 °C)" is left as it is.
 */
export function inScale(text, s = scale()) {
  if (s !== 'F') return text
  return text
    .replace(/(\d+ °F) \(\d+ °C\)/g, '$1')
    .replace(/\(°C\)/g, '(°F)')
    .replace(/(\d+(?:\.\d+)?) °C/g, (_, n) => `${Math.round(toF(Number(n)))} °F (${n} °C)`)
}
