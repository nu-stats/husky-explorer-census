// Totals within a distance of a point. Each area counts in proportion to the share of its land that
// lies inside the circle (areal weighting), which assumes people are spread evenly within an area.
// Small areas (block groups, tracts) keep that assumption close; a county is too coarse for a small circle.

const MILE_LON = 69.172
const MILE_LAT = 69.0

/**
 * A circle as a ring of [lon, lat] points, counterclockwise.
 * @param {number} lon @param {number} lat @param {number} miles @param {number} [n]
 * @returns {number[][]}
 */
export function circleRing(lon, lat, miles, n = 96) {
  const dy = miles / MILE_LAT
  const dx = miles / (MILE_LON * Math.cos((lat * Math.PI) / 180))
  const ring = []
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n
    ring.push([lon + dx * Math.cos(a), lat + dy * Math.sin(a)])
  }
  return ring
}

/** Signed area (shoelace) of a ring of [x, y]. */
export function ringArea(ring) {
  let s = 0
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[(i + 1) % ring.length]
    s += x1 * y2 - x2 * y1
  }
  return s / 2
}

// Sutherland-Hodgman: the part of `subject` inside the convex, counterclockwise `clip`.
function clipRing(subject, clip) {
  let out = subject
  for (let i = 0; i < clip.length && out.length; i++) {
    const [ax, ay] = clip[i]
    const [bx, by] = clip[(i + 1) % clip.length]
    const side = ([x, y]) => (bx - ax) * (y - ay) - (by - ay) * (x - ax)
    const input = out
    out = []
    for (let j = 0; j < input.length; j++) {
      const p = input[j]
      const q = input[(j + 1) % input.length]
      const sp = side(p)
      const sq = side(q)
      if (sp >= 0) out.push(p)
      if ((sp >= 0) !== (sq >= 0)) {
        const t = sp / (sp - sq)
        out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])])
      }
    }
  }
  return out
}

/**
 * The share (0 to 1) of a polygon or multipolygon's area that lies inside the circle. Holes count.
 * @param {{ type: string, coordinates: any }} geometry in lon/lat
 * @param {number[][]} circle ring from circleRing
 */
export function shareInside(geometry, circle) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : []
  // One planar frame for the circle and the shapes: miles east and north of the circle's center.
  const lon0 = circle.reduce((s, p) => s + p[0], 0) / circle.length
  const lat0 = circle.reduce((s, p) => s + p[1], 0) / circle.length
  const k = Math.cos((lat0 * Math.PI) / 180)
  const flat = (ring) => ring.map(([x, y]) => [(x - lon0) * k * MILE_LON, (y - lat0) * MILE_LAT])
  const c = flat(circle)
  const [minX, maxX, minY, maxY] = [Math.min(...c.map((p) => p[0])), Math.max(...c.map((p) => p[0])), Math.min(...c.map((p) => p[1])), Math.max(...c.map((p) => p[1]))]
  let total = 0
  let inside = 0
  for (const poly of polygons) {
    poly.forEach((raw, i) => {
      const ring = flat(raw)
      const sign = i === 0 ? 1 : -1
      const area = Math.abs(ringArea(ring))
      total += sign * area
      const xs = ring.map((p) => p[0])
      const ys = ring.map((p) => p[1])
      if (Math.max(...xs) < minX || Math.min(...xs) > maxX || Math.max(...ys) < minY || Math.min(...ys) > maxY) return
      // The clip needs the subject counterclockwise only to keep the sign; area is taken absolute.
      inside += sign * Math.abs(ringArea(clipRing(ring, c)))
    })
  }
  return total > 0 ? Math.min(1, Math.max(0, inside / total)) : 0
}

/**
 * One measure summed over the shares of the areas in the circle: a count adds up; a percent that has
 * a denominator is the shared numerator over the shared denominator. Medians, rates and modeled
 * percentages cannot be added across areas, so they get no summary.
 * @param {{ unit: string, est: string[], den?: string, extra?: boolean, upload?: boolean }} m
 * @param {{ cell: (geoid: string, id: string) => number | null }} table
 * @param {Map<string, number>} shares geoid -> share of the area inside
 * @returns {{ value: number, unit: 'count' | 'percent', missing: number } | null}
 */
export function summarize(m, table, shares) {
  if (m.extra || m.upload) return null
  const cell = (g, id) => table.cell(g, id + 'E') ?? table.cell(g, id + 'N') ?? table.cell(g, id)
  const counted = m.unit === 'count' && !m.den
  const percent = m.unit === 'percent' && m.den
  if (!counted && !percent) return null
  let num = 0
  let den = 0
  let missing = 0
  for (const [g, share] of shares) {
    const parts = m.est.map((id) => cell(g, id))
    const d = percent ? cell(g, m.den) : 0
    if (parts.some((x) => x === null) || d === null) {
      missing++
      continue
    }
    num += share * parts.reduce((s, x) => s + x, 0)
    den += share * d
  }
  if (percent) return den > 0 ? { value: (100 * num) / den, unit: 'percent', missing } : null
  return { value: num, unit: 'count', missing }
}
