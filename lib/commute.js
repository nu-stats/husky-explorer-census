// Pure helpers for the commuting flow map: a flat projection, outlines as SVG paths, curved lines between county centers,
// and the table of a home county's biggest work destinations.
import { centerOf } from './regions.js'

/**
 * A projection for a small region (a county and the counties it sends workers to): longitude scaled by the cosine of the middle
 * latitude, so shapes keep roughly their proportions. y grows downward, as in SVG.
 * @param {number[][]} points lon/lat points the view must hold
 * @param {number} width the drawing's width in SVG units
 * @param {number} pad margin around the points, as a fraction of the larger side
 */
export function projection(points, width = 900, pad = 0.12) {
  const lons = points.map((p) => p[0])
  const lats = points.map((p) => p[1])
  const [w, e, s, n] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)]
  const k = Math.cos((((s + n) / 2) * Math.PI) / 180)
  const spanX = Math.max((e - w) * k, 1e-6)
  const spanY = Math.max(n - s, 1e-6)
  const margin = Math.max(spanX, spanY) * pad
  const scale = width / (spanX + 2 * margin)
  const height = (spanY + 2 * margin) * scale
  return {
    width,
    height,
    project: ([lon, lat]) => [(lon - w) * k * scale + margin * scale, (n - lat) * scale + margin * scale],
  }
}

/** An SVG path for a Polygon or MultiPolygon in lon/lat. */
export function geometryPath(geometry, project) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : []
  return polys
    .flatMap((p) => p.map((ring) => 'M' + ring.map((pt) => project(pt).map((v) => v.toFixed(1)).join(',')).join('L') + 'Z'))
    .join('')
}

/** A gentle curve from a to b (SVG points): the control point is pushed to the left of the line by a fifth of its length. */
export function arcPath([ax, ay], [bx, by]) {
  const dx = bx - ax
  const dy = by - ay
  const cx = (ax + bx) / 2 - dy * 0.2
  const cy = (ay + by) / 2 + dx * 0.2
  return `M${ax.toFixed(1)},${ay.toFixed(1)}Q${cx.toFixed(1)},${cy.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}`
}

/** A line's width in SVG units, growing with the square root of the jobs so a few big flows do not hide the rest. */
export const strokeFor = (jobs, biggest, max = 14) => (biggest > 0 ? Math.max(1, (Math.sqrt(jobs) / Math.sqrt(biggest)) * max) : 1)

/**
 * The destination table of a home county.
 * @param {{ total: number, to: [string, number][] }} flow
 * @param {string} home the home county id
 * @param {(id: string) => string} nameOf
 */
export function destinationRows(flow, home, nameOf) {
  return flow.to.map(([id, jobs]) => ({ id, name: nameOf(id), jobs, share: flow.total > 0 ? (100 * jobs) / flow.total : null, stays: id === home }))
}

/** The county centers (lon/lat) of the features, by id. */
export function centers(features) {
  const out = new Map()
  for (const f of features) {
    const c = f.geometry ? centerOf(f.geometry) : null
    const id = f.id ?? f.properties?.id
    if (c && id) out.set(id, c)
  }
  return out
}
