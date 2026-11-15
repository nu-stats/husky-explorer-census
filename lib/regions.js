// Custom regions: a set of whole census areas (tracts, towns, ZIP code areas…) chosen by clicking or by drawing a
// shape, saved under a name, and summarized as one place. Whole areas only, so a region adds up exactly: no shares,
// no guessing how people are spread inside an area.

/** Ray casting: is the point inside the ring of [x, y]? */
export function pointInRing([x, y], ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function ringCentroid(ring) {
  let a = 0
  let cx = 0
  let cy = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
    a += cross
    cx += (ring[j][0] + ring[i][0]) * cross
    cy += (ring[j][1] + ring[i][1]) * cross
  }
  if (a === 0) return { area: 0, point: ring[0] ?? [0, 0] }
  return { area: Math.abs(a / 2), point: [cx / (3 * a), cy / (3 * a)] }
}

/**
 * A point to stand for a shape: the centroid of its largest outer ring. For a very odd shape (a crescent) it can
 * fall outside, which is acceptable for deciding whether a drawn shape "contains" an area.
 * @param {{ type: string, coordinates: any }} geometry in lon/lat
 */
export function centerOf(geometry) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : []
  let best = null
  for (const p of polys) {
    const c = ringCentroid(p[0] ?? [])
    if (!best || c.area > best.area) best = c
  }
  return best ? best.point : null
}

/**
 * The areas whose center lies inside a drawn ring.
 * @param {{ id?: string, properties?: { id?: string }, geometry: any }[]} features GeoJSON features in lon/lat
 * @param {number[][]} ring the drawn shape in lon/lat
 * @returns {string[]}
 */
export function idsInside(features, ring) {
  const out = []
  for (const f of features) {
    const c = f.geometry ? centerOf(f.geometry) : null
    if (c && pointInRing(c, ring)) out.push(f.id ?? f.properties?.id)
  }
  return out.filter(Boolean)
}

/**
 * @typedef {{ name: string, level: string, state: string, ids: string[] }} Region
 * A region file's text to regions, keeping only what is well formed.
 */
export function readRegionsFile(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('That file is not a regions file (it is not JSON).')
  }
  const list = Array.isArray(data?.regions) ? data.regions : []
  const out = []
  for (const r of list) {
    if (typeof r?.name !== 'string' || typeof r.level !== 'string' || typeof r.state !== 'string' || !Array.isArray(r.ids)) continue
    const ids = r.ids.filter((x) => typeof x === 'string' && /^[0-9A-Za-z]{2,12}$/.test(x)).slice(0, 50000)
    if (ids.length) out.push({ name: r.name.slice(0, 80), level: r.level, state: r.state, ids })
  }
  if (!out.length) throw new Error('No regions were found in that file.')
  return out
}

export const regionsFile = (regions) => JSON.stringify({ husky: 'regions', version: 1, regions }, null, 1)

/**
 * One measure added up over whole areas: a count adds up, a percent with a denominator is the summed numerator over the
 * summed denominator. Medians, rates, indexes and modeled percentages cannot be added across areas and get no summary.
 * @param {{ unit: string, est: string[], den?: string, upload?: boolean }} m
 * @param {{ cell: (geoid: string, id: string) => number | null }} table
 * @param {Iterable<string>} ids
 * @returns {{ value: number, unit: 'count' | 'percent', missing: number } | null}
 */
export function regionSummary(m, table, ids) {
  if (m.upload) return null
  const cell = (g, id) => table.cell(g, id + 'E') ?? table.cell(g, id + 'N') ?? table.cell(g, id)
  const counted = m.unit === 'count' && !m.den
  const percent = m.unit === 'percent' && !!m.den
  if (!counted && !percent) return null
  let num = 0
  let den = 0
  let missing = 0
  for (const g of ids) {
    const parts = m.est.map((id) => cell(g, id))
    const d = percent ? cell(g, m.den) : 0
    if (parts.some((x) => x === null) || d === null) {
      missing++
      continue
    }
    num += parts.reduce((s, x) => s + x, 0)
    den += d
  }
  if (percent) return den > 0 ? { value: (100 * num) / den, unit: 'percent', missing } : null
  return { value: num, unit: 'count', missing }
}
