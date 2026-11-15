// Heat over time: what each yearly measure is, how to read a place's series out of a value file, and the
// small geometry the page's own map needs. Two sources feed the page:
//   era5  county heat metrics 2000-2020 (Spangler et al.): WBGT, heat index, air temperature, dew point
//   prism estimated wet-bulb temperature 2000-2024, tracts, counties and states, from PRISM's daily grids
// Only the second is wet-bulb temperature, and it is an estimate; the page marks every such value with a quiet "≈".

import { degrees, inUnits } from './temperature.js'

export const FIRST_YEAR = 2000
export const LAST_YEAR = 2020
export const YEARS = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i)

/** The years a measure covers, from its [first, last]. */
export const yearsOf = (m) => Array.from({ length: m.years[1] - m.years[0] + 1 }, (_, i) => m.years[0] + i)

const ERA5 = { source: 'era5', years: [2000, 2020], levels: ['county'], group: 'Heat index, WBGT and air temperature (county, ERA5-Land)', estimated: false }

// The estimate, said once and quietly.
export const WETBULB_NOTE =
  'Estimated from PRISM’s daily highest temperature and average dew point (a day’s average dew point stands in for the afternoon’s, and elevation is not corrected). Small areas share a 4 km grid, so nearby tracts have nearly the same value.'

const WB_ABOUT =
  'Wet-bulb temperature is the lowest temperature air can be cooled to by evaporating water, so it combines heat and humidity: the higher it is, the less sweat can cool you. Each day’s peak is estimated from PRISM’s highest air temperature and average dew point, May to September.'
const PRISM = {
  source: 'prism',
  years: [2000, 2024],
  levels: ['county', 'tract'],
  group: 'Wet-bulb temperature (estimated, PRISM)',
  estimated: true,
  estimateNote: WETBULB_NOTE,
}

/**
 * @typedef {{ id: string, label: string, short: string, unit: 'celsius' | 'days', about: string, source: 'era5' | 'prism',
 *   years: number[], levels: string[], group: string, estimated: boolean, estimateNote?: string }} HeatMeasure
 * @type {HeatMeasure[]}
 */
export const HEAT_MEASURES = [
  { ...PRISM, id: 'WB24', label: 'Days a year with wet-bulb temperature at 24 °C or more', short: 'Days wet-bulb ≥ 24 °C', unit: 'days', about: `${WB_ABOUT} 24 °C is where humid heat starts to feel oppressive.` },
  { ...PRISM, id: 'WB26', label: 'Days a year with wet-bulb temperature at 26 °C or more', short: 'Days wet-bulb ≥ 26 °C', unit: 'days', about: `${WB_ABOUT} At 26 °C hard work in the open becomes risky.` },
  { ...PRISM, id: 'WB28', label: 'Days a year with wet-bulb temperature at 28 °C or more', short: 'Days wet-bulb ≥ 28 °C', unit: 'days', about: `${WB_ABOUT} 28 °C is dangerous even for people at rest in the shade, and rare in the United States.` },
  { ...PRISM, id: 'WBX', label: 'Hottest day of the year: wet-bulb temperature (°C)', short: 'Hottest-day wet-bulb', unit: 'celsius', about: `${WB_ABOUT} This is the highest daily peak of the season.` },
  { ...PRISM, id: 'WBS', label: 'Summer average of the daily peak wet-bulb temperature (°C)', short: 'Summer mean wet-bulb', unit: 'celsius', about: `${WB_ABOUT} This averages the daily peak over the 153 days.` },
  {
    ...ERA5,
    id: 'WBGT28',
    label: 'Days a year with wet-bulb globe temperature (WBGT) at 28 °C or more',
    short: 'Days WBGT ≥ 28 °C',
    unit: 'days',
    about: 'Wet-bulb globe temperature is a heat-stress index that combines temperature, humidity, sun and wind. It is not the same as wet-bulb temperature. 28 °C is a common limit for hard outdoor work; here it counts days when the day’s highest value reached it.',
  },
  {
    ...ERA5,
    id: 'WBGTX',
    label: 'Hottest day of the year: wet-bulb globe temperature (°C)',
    short: 'Hottest-day WBGT',
    unit: 'celsius',
    about: 'The highest daily maximum wet-bulb globe temperature of the year. WBGT combines temperature, humidity, sun and wind; it is not wet-bulb temperature.',
  },
  {
    ...ERA5,
    id: 'WBGTS',
    label: 'Summer average wet-bulb globe temperature, May to September (°C)',
    short: 'Summer mean WBGT',
    unit: 'celsius',
    about: 'The average of the daily mean wet-bulb globe temperature over May to September (WBGT is not wet-bulb temperature).',
  },
  {
    ...ERA5,
    id: 'HI95',
    label: 'Days a year with heat index at 95 °F (35 °C) or more',
    short: 'Days heat index ≥ 95 °F',
    unit: 'days',
    about: 'The heat index is a “feels like” temperature that adds humidity to air temperature. This counts days when the day’s highest heat index reached 95 °F, the line CDC’s tracking network uses for a hot day.',
  },
  {
    ...ERA5,
    id: 'HIX',
    label: 'Hottest day of the year: heat index (°C)',
    short: 'Hottest-day heat index',
    unit: 'celsius',
    about: 'The highest daily maximum heat index of the year, in °C (a heat index of 35 °C is 95 °F).',
  },
  {
    ...ERA5,
    id: 'T95',
    label: 'Days a year with air temperature at 95 °F (35 °C) or more',
    short: 'Days air temp ≥ 95 °F',
    unit: 'days',
    about: 'Days when the day’s highest air temperature reached 95 °F (35 °C), with no humidity adjustment.',
  },
  {
    ...ERA5,
    id: 'TDS',
    label: 'Summer average dew point, May to September (°C)',
    short: 'Summer mean dew point',
    unit: 'celsius',
    about: 'The average of the daily mean dew point over May to September. The dew point is a direct measure of how much water vapor is in the air: the higher it is, the muggier it feels.',
  },
]

/** A heat value as people read it: "29 days", "31.7 °C", or "no data". */
export function formatHeat(value, unit, scale = 'C') {
  if (value === null || value === undefined || Number.isNaN(value)) return 'no data'
  if (unit === 'days') return `${Math.round(value * 10) / 10} ${Math.round(value * 10) / 10 === 1 ? 'day' : 'days'}`
  return degrees(value, scale)
}

/** The same, with a small "≈" in front when the value is an estimate (and there is a value to mark). */
export function shownHeat(value, unit, estimated, scale = 'C') {
  const text = formatHeat(value, unit, scale)
  return estimated && text !== 'no data' ? `≈ ${text}` : text
}

/**
 * One place's yearly series for a measure, from a value file (the build's { variables, rows }): an array in
 * year order with null for a year with too little data.
 */
export function seriesOf(file, geoid, measureId, years = YEARS) {
  const row = file.rows[geoid]
  return years.map((year) => {
    const i = file.variables.indexOf(`${measureId}_${year}`)
    const v = row && i >= 0 ? row.v[i] : null
    return v === undefined ? null : v
  })
}

/** A series of °C values in the chosen scale (days and other units are left alone). */
export const seriesIn = (series, unit, scale) => (unit === 'celsius' ? series.map((v) => inUnits(v, scale)) : series)

/** Every place's series for a measure: Map geoid -> array in year order. */
export function allSeries(file, measureId, years = YEARS, keep = () => true) {
  return new Map(Object.keys(file.rows).filter(keep).map((geoid) => [geoid, seriesOf(file, geoid, measureId, years)]))
}

/**
 * Breaks that stay the same for every year, so a map can be compared across years: equal steps between the
 * 2nd and 98th percentile of all values in every year (a few extreme places would otherwise flatten the rest).
 * @returns {{ min: number, breaks: number[] }}
 */
export function fixedBreaks(seriesByPlace, classes, clip) {
  const all = []
  for (const s of seriesByPlace.values()) for (const v of s) if (v !== null) all.push(v)
  if (!all.length) return { min: 0, breaks: [] }
  const [lo, hi] = clip(all)
  const step = (hi - lo) / classes || 1
  return { min: lo, breaks: Array.from({ length: classes }, (_, i) => (i === classes - 1 ? hi : lo + step * (i + 1))) }
}

/**
 * Splits a series into runs of consecutive years that have values, so a chart line breaks across a gap instead
 * of joining across it. Each run is [[yearIndex, value], ...].
 */
export function runs(series) {
  const out = []
  let run = []
  series.forEach((v, i) => {
    if (v === null) {
      if (run.length) out.push(run)
      run = []
    } else run.push([i, v])
  })
  if (run.length) out.push(run)
  return out
}

/**
 * SVG path data for GeoJSON polygons on a flat plot, longitude scaled by the cosine of the middle latitude.
 * @param {{ type: string, coordinates: any }[]} geometries
 * @param {number} width plot width in pixels
 * @returns {{ paths: string[], height: number }}
 */
export function projectPaths(geometries, width, pad = 6) {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  const eachRing = (g, fn) => {
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
    for (const p of polys) for (const ring of p) fn(ring)
  }
  for (const g of geometries) {
    eachRing(g, (ring) => {
      for (const [x, y] of ring) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    })
  }
  if (!Number.isFinite(minX)) return { paths: geometries.map(() => ''), height: 0 }
  const k = Math.cos((((minY + maxY) / 2) * Math.PI) / 180)
  const spanX = (maxX - minX) * k || 1
  const scale = (width - 2 * pad) / spanX
  const height = Math.ceil((maxY - minY) * scale + 2 * pad)
  const px = (x) => ((x - minX) * k * scale + pad).toFixed(1)
  const py = (y) => ((maxY - y) * scale + pad).toFixed(1)
  const paths = geometries.map((g) => {
    let d = ''
    eachRing(g, (ring) => {
      d += 'M' + ring.map(([x, y]) => `${px(x)} ${py(y)}`).join('L') + 'Z'
    })
    return d
  })
  return { paths, height }
}
