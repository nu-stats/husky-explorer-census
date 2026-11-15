// Margins of error, by the U.S. Census Bureau's published approximation formulas
// ("Understanding and Using American Community Survey Data: What All Data Users
// Need to Know", Appendix 3). Margins are at the 90 percent confidence level.

/** MOE of a sum or difference of estimates: the square root of the sum of squared MOEs. */
export function moeOfSum(moes) {
  if (moes.some((m) => m === null || m === undefined)) return null
  return Math.sqrt(moes.reduce((s, m) => s + m * m, 0))
}

/**
 * MOE of a proportion p = num / den, where num is part of den. When the number
 * under the root would be negative, the ratio formula (plus sign) is used.
 */
export function moeOfProportion(num, moeNum, den, moeDen) {
  if (moeNum === null || moeDen === null || !(den > 0)) return null
  const p = num / den
  const under = moeNum * moeNum - p * p * moeDen * moeDen
  const root = Math.sqrt(under >= 0 ? under : moeNum * moeNum + p * p * moeDen * moeDen)
  return root / den
}
