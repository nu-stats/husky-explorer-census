// Color ramps: nine-class ColorBrewer schemes (Cynthia Brewer, Mark Harrower and
// The Pennsylvania State University, Apache-2.0), shared by interpolating the
// nine colors, light to dark, to however many classes are asked for.

export const RAMPS = {
  Blues: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
  Greens: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'],
  Purples: ['#fcfbfd', '#efedf5', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#54278f', '#3f007d'],
  YlOrRd: ['#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#bd0026', '#800026'],
  Oranges: ['#fff5eb', '#fee6ce', '#fdd0a2', '#fdae6b', '#fd8d3c', '#f16913', '#d94801', '#a63603', '#7f2704'],
}

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
const toHex = (rgb) => '#' + rgb.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')

/** n colors from a ramp, light to dark. One class gets a middle-dark color. */
export function rampColors(name, n) {
  const base = RAMPS[name]
  if (!base) throw new Error(`Unknown color ramp "${name}".`)
  if (n <= 1) return [base[6]]
  return Array.from({ length: n }, (_, i) => {
    // Start at the second color so the lightest class still shows on a white page.
    const t = 1 + (i * (base.length - 2)) / (n - 1)
    const lo = Math.floor(t)
    const hi = Math.min(base.length - 1, lo + 1)
    const f = t - lo
    const a = hex(base[lo])
    const b = hex(base[hi])
    return toHex(a.map((x, k) => x + (b[k] - x) * f))
  })
}
