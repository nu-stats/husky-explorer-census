// The measures the map can show, and how each is computed from a value file.
// A value file is { variables: [ids], rows: { GEOID: { n: name, v: [numbers or null] } } }.

import { dropHeldBack } from './clearance.js'
import { moeOfProportion, moeOfSum } from './moe.js'

/**
 * @typedef {{
 *   id: string, label: string, dataset: string, table: string,
 *   unit: 'count' | 'dollars' | 'percent' | 'years' | 'ugm3' | 'ppb' | 'celsius' | 'days' | 'index' | 'per100' | 'per100k' | 'per1000', ramp: string, note?: string,
 *   levels?: string[],    // the levels the source covers (all of them when absent)
 *   vintage?: number,     // the boundary set the values belong to: 2010 for the 2010 census (2024, the current one, when absent)
 *   clip?: boolean,       // set the map's classes from the middle 96 percent (for values with a few extreme outliers)
 *   extra?: boolean,      // a source beyond the Census tables; not chosen by default on the compare page
 *   group?: string,       // the heading it is listed under (the Census tables when absent)
 *   credit?: string,      // the source's credit line, for downloads
 *   est: string[],        // variables added up for the estimate (or the numerator of a percent)
 *   den?: string,         // the universe, for a percent
 * }} Measure
 */

/** @type {Measure[]} */
// The profile tables are fetched for everything but block groups; the state level is for the profile's yardstick.
const NOT_BG = ['state', 'county', 'cousub', 'place', 'zcta', 'tract']

export const MEASURES = [
  { id: 'pop2024', label: 'Total population (ACS 2020–24)', dataset: 'acs5-2024', table: 'B01003', unit: 'count', ramp: 'Blues', est: ['B01003_001'] },
  { id: 'pop2020', label: 'Total population (2020 Census)', dataset: 'dec-2020', table: 'P1', unit: 'count', ramp: 'Blues', est: ['P1_001'] },
  { id: 'income', label: 'Median household income', dataset: 'acs5-2024', table: 'B19013', unit: 'dollars', ramp: 'Greens', est: ['B19013_001'] },
  { id: 'poverty', label: 'People below the poverty level', dataset: 'acs5-2024', table: 'B17001', unit: 'percent', ramp: 'Oranges', est: ['B17001_002'], den: 'B17001_001' },
  { id: 'renter', label: 'Renter-occupied homes', dataset: 'acs5-2024', table: 'B25003', unit: 'percent', ramp: 'Purples', est: ['B25003_003'], den: 'B25003_001' },
  { id: 'hispanic', label: 'Hispanic or Latino residents', dataset: 'acs5-2024', table: 'B03002', unit: 'percent', ramp: 'Purples', est: ['B03002_012'], den: 'B03002_001' },
  {
    id: 'bachelors',
    label: 'Adults 25+ with a bachelor’s degree or more',
    dataset: 'acs5-2024',
    table: 'B15003',
    unit: 'percent',
    ramp: 'Greens',
    est: ['B15003_022', 'B15003_023', 'B15003_024', 'B15003_025'],
    den: 'B15003_001',
  },
  { id: 'foreign-born', label: 'Foreign-born residents', dataset: 'acs5-2024', table: 'B05002', unit: 'percent', ramp: 'Purples', est: ['B05002_013'], den: 'B05002_001', levels: ['state', 'county', 'tract'] },
  ...[
    ['born-europe', 'Europe', 'B05006_002'],
    ['born-asia', 'Asia', 'B05006_047'],
    ['born-africa', 'Africa', 'B05006_095'],
    ['born-latin-america', 'Latin America', 'B05006_139'],
  ].map(([id, region, variable]) => ({
    id,
    label: `Foreign-born from ${region}`,
    dataset: 'acs5-2024',
    table: 'B05006',
    unit: 'percent',
    ramp: 'Purples',
    est: [variable],
    den: 'B05006_001',
    levels: ['state', 'county', 'tract'],
    extra: true, // optional on the compare page; the Census source and notice are the same
    group: 'Place of birth (ACS)',
    note: `Percent of the foreign-born population born in ${region}. Small places have wide margins of error.`,
  })),
  // Housing and work, for the place profile and optional on the compare page.
  { id: 'home-value', label: 'Median home value', dataset: 'acs5-2024', table: 'B25077', unit: 'dollars', ramp: 'Greens', est: ['B25077_001'], levels: NOT_BG, extra: true, group: 'Housing and work (ACS)' },
  { id: 'median-rent', label: 'Median gross rent', dataset: 'acs5-2024', table: 'B25064', unit: 'dollars', ramp: 'Oranges', est: ['B25064_001'], levels: NOT_BG, extra: true, group: 'Housing and work (ACS)' },
  { id: 'unemployment', label: 'Unemployment rate', dataset: 'acs5-2024', table: 'B23025', unit: 'percent', ramp: 'Oranges', est: ['B23025_005'], den: 'B23025_003', levels: NOT_BG, extra: true, group: 'Housing and work (ACS)', note: 'Unemployed people as a percent of the civilian labor force.' },
]

// The 2010 census, counted on the 2010 tracts and block groups, which differ from today's in places.
MEASURES.push({
  id: 'pop2010',
  label: 'Total population (2010 Census, 2010 boundaries)',
  dataset: 'dec-2010',
  table: 'P1',
  unit: 'count',
  ramp: 'Blues',
  est: ['P001001'],
  vintage: 2010,
  levels: ['county', 'cousub', 'place', 'tract', 'blockgroup'],
  extra: true,
  group: '2010 Census',
  note: 'Counts from the 2010 Census, shown on the 2010 tracts and block groups, which differ from today’s in places.',
})

// The 2000 census, counted on the 2000 tracts and block groups, which differ from today's (and from 2010's) in places.
MEASURES.push({
  id: 'pop2000',
  label: 'Total population (2000 Census, 2000 boundaries)',
  dataset: 'dec-2000',
  table: 'P1',
  unit: 'count',
  ramp: 'Blues',
  est: ['P001001'],
  vintage: 2000,
  levels: ['county', 'cousub', 'place', 'tract', 'blockgroup'],
  extra: true,
  group: '2000 Census',
  note: 'Counts from the 2000 Census, shown on the 2000 tracts and block groups, which differ from today’s in places.',
})

// Change between the 2010 and 2020 censuses on today's counties and tracts. County values are direct
// counts; tract values go through the crosswalk, so they are estimates.
const CHANGE_CREDIT =
  'Change since 2010: U.S. Census Bureau, 2010 and 2020 Censuses. County values compare the two counts directly; tract values are estimates made by carrying 2010 counts onto 2020 tracts through the Census Bureau’s block relationship files (method after Logan, Xu and Stults 2014). A percent change is not shown where a place had fewer than 100 people in 2010.'
const change = (id, label, variable, unit, ramp, note) => ({
  id,
  label,
  dataset: 'change-2010-2020',
  table: 'CHG',
  unit,
  ramp,
  est: [variable],
  levels: ['county', 'tract'],
  extra: true,
  clip: true,
  group: 'Change since 2010',
  credit: CHANGE_CREDIT,
  note,
})

MEASURES.push(
  change('pop-change-pct', 'Population change, 2010 to 2020 (percent)', 'CHG', 'percent', 'Oranges', 'Counties: exact counts. Tracts: estimated by carrying 2010 counts onto 2020 tracts. No percent where fewer than 100 people lived there in 2010.'),
  change('pop-change', 'Population change, 2010 to 2020 (people)', 'DIF', 'count', 'Purples', 'Counties: exact counts. Tracts: estimated by carrying 2010 counts onto 2020 tracts.'),
  change('pop2010-on-2020', 'Population in 2010, on today’s areas (estimated for tracts)', 'P10', 'count', 'Blues', 'Counties: exact 2010 counts. Tracts: the 2010 count carried onto 2020 tracts, an estimate.'),
)

// CDC PLACES: modeled small-area estimates of the percent of adults (crude
// prevalence), for counties and tracts only. No margin of error is shown: the
// source gives 95 percent confidence limits, not the Bureau's 90 percent margins.
const places = (id, label, ramp, note) => ({
  id: 'places-' + id.toLowerCase(),
  label: `${label} (CDC PLACES)`,
  dataset: 'places-2025',
  table: 'PLACES',
  unit: 'percent',
  ramp,
  est: [id],
  levels: ['county', 'tract'],
  extra: true,
  group: 'Health (CDC PLACES)',
  credit:
    'Health measures: Centers for Disease Control and Prevention, PLACES 2025 release (public domain). Modeled small-area estimates of the percent of adults, not counts; no margin of error is given.',
  note: note ?? 'Modeled estimate, percent of adults, not a count.',
})

MEASURES.push(
  places('OBESITY', 'Adults with obesity', 'Oranges'),
  places('DIABETES', 'Adults with diagnosed diabetes', 'Oranges'),
  places('BPHIGH', 'Adults with high blood pressure', 'Oranges'),
  places('CHD', 'Adults with coronary heart disease', 'Oranges'),
  places('STROKE', 'Adults who have had a stroke', 'Oranges'),
  places('CASTHMA', 'Adults with current asthma', 'Oranges'),
  places('DEPRESSION', 'Adults with depression', 'Oranges'),
  places('MHLTH', 'Adults with frequent mental distress', 'Oranges'),
  places('PHLTH', 'Adults with frequent physical distress', 'Oranges'),
  places('GHLTH', 'Adults in fair or poor health', 'Oranges'),
  places('CSMOKING', 'Adults who currently smoke', 'Oranges'),
  places('LPA', 'Adults with no leisure-time physical activity', 'Oranges'),
  places('DISABILITY', 'Adults with any disability', 'Oranges'),
  places('ACCESS2', 'Adults 18–64 without health insurance', 'Purples'),
  places('FOODINSECU', 'Adults with food insecurity', 'Purples'),
  places('HOUSINSECU', 'Adults with housing insecurity', 'Purples'),
  places('LACKTRPT', 'Adults lacking reliable transportation', 'Purples'),
  places('LONELINESS', 'Adults who are lonely', 'Purples'),
)

// USALEEP life expectancy at birth, 2010-2015, for tracts that kept their code since 2010.
MEASURES.push({
  id: 'life-expectancy',
  label: 'Life expectancy at birth, 2010–2015 (USALEEP)',
  dataset: 'usaleep-2015',
  table: 'LE',
  unit: 'years',
  ramp: 'Greens',
  est: ['LE'],
  levels: ['tract'],
  extra: true,
  group: 'Life expectancy (NCHS)',
  credit:
    'Life expectancy: National Center for Health Statistics, U.S. Small-area Life Expectancy Estimates Project (USALEEP), 2010–2015. Tracts redrawn since 2010 have no value. Margins of error are at the 90 percent confidence level.',
  note: 'Years, 2010–2015, on 2010 tract boundaries. Tracts redrawn in 2020 have no value.',
})

// CDC Environmental Public Health Tracking, on 2020 tracts. No margin of error.
const environment = (id, label, unit, ramp, note) => ({
  id,
  label,
  dataset: 'epht-2022',
  table: 'ENV',
  unit,
  ramp,
  est: [{ pm25: 'PM25', ozone: 'O3', parks: 'PARK' }[id.split('-')[1]]],
  levels: ['tract'],
  extra: true,
  group: 'Environment (CDC Tracking)',
  credit:
    'Environment: Centers for Disease Control and Prevention, National Environmental Public Health Tracking Network (www.cdc.gov/ephtracking). Air quality is the EPA Downscaler model, a 2022 average; park access is 2020. Interpretations here are not CDC’s. No margin of error is given.',
  note,
})

MEASURES.push(
  environment('air-pm25', 'Fine particles, PM2.5, 2022 average (CDC)', 'ugm3', 'Oranges', 'Modeled average of daily predictions for 2022, micrograms per cubic meter.'),
  environment('air-ozone', 'Ozone, 2022 average (CDC)', 'ppb', 'Oranges', 'Modeled average of daily predictions for 2022, parts per billion.'),
  environment('air-parks', 'People within half a mile of a park, 2020 (CDC)', 'percent', 'Greens', 'Percent of people living within half a mile of a park, 2020.'),
)

/** Index a value file for lookups by GEOID and variable. */
export function indexTable(file) {
  const col = new Map(file.variables.map((id, i) => [id, i]))
  const cell = (geoid, id) => {
    const row = file.rows[geoid]
    const i = col.get(id)
    return row && i !== undefined ? (row.v[i] ?? null) : null
  }
  return { file, name: (geoid) => file.rows[geoid]?.n ?? geoid, has: (geoid) => geoid in file.rows, cell }
}

/**
 * The estimate and margin of error of a measure for one place. Both are null
 * when the data are missing; the margin is null for the decennial census,
 * which has none, and for ACS controlled totals, which the Bureau gives none.
 * @param {Measure} m
 * @returns {{ est: number | null, moe: number | null }}
 */
export function measureValue(m, table, geoid) {
  // ACS columns end in E, 2020 census counts in N; the 2010 census names a count with no suffix.
  const e = (id) => table.cell(geoid, id + 'E') ?? table.cell(geoid, id + 'N') ?? table.cell(geoid, id)
  const mo = (id) => table.cell(geoid, id + 'M')
  const parts = m.est.map(e)
  if (parts.some((x) => x === null)) return { est: null, moe: null }
  const sum = parts.reduce((s, x) => s + x, 0)
  const sumMoe = moeOfSum(m.est.map(mo))
  if (!m.den) return { est: sum, moe: sumMoe }
  const den = e(m.den)
  if (den === null || den === 0) return { est: null, moe: null }
  // A total with an estimate but no margin is a controlled total (the Bureau sets it to an
  // official count), which the handbook treats as exact: its margin is 0.
  const moe = moeOfProportion(sum, sumMoe, den, mo(m.den) ?? 0)
  return { est: (100 * sum) / den, moe: moe === null ? null : 100 * moe }
}

import { inScale } from './temperature.js'
import { CRIME_WARNING_SHORT } from './crime-notice.js'

// Estimated wet-bulb temperature for the latest year of the heat page's PRISM series; the Heat over time page has every year.
const WB_NOTE = 'Estimated by Husky Explorer from PRISM’s daily highest temperature and average dew point, May to September 2024; small areas share a 4 km grid. One year bounces with the weather: see Heat over time for the series, where you can also switch between °F and °C.'
const WB_CREDIT =
  'Wet-bulb temperature: estimated from daily PRISM data (PRISM Group, Oregon State University, https://prism.oregonstate.edu); computed by Husky Explorer, not measured or published by PRISM. Not recommended for very long-term trends (PRISM).'
for (const [id, v, label, unit, ramp] of [
  ['wb24', 'WB24_2024', 'Days wet-bulb temperature reached 24 °C, summer 2024 (estimated)', 'days', 'YlOrRd'],
  ['wbx', 'WBX_2024', 'Hottest-day wet-bulb temperature, summer 2024 (estimated)', 'celsius', 'YlOrRd'],
  ['wbs', 'WBS_2024', 'Summer-average daily peak wet-bulb temperature, 2024 (estimated)', 'celsius', 'YlOrRd'],
]) {
  MEASURES.push({ id, label: inScale(label), dataset: 'wetbulb-prism', table: 'WB', unit, ramp, est: [v], levels: ['county', 'tract'], extra: true, group: 'Heat (estimated wet-bulb, PRISM)', credit: WB_CREDIT, note: WB_NOTE })
}

// Vulnerability, food access, opportunity, walkability and evictions: sources beyond the Census tables.
const SVI_CREDIT = 'Social vulnerability: CDC/ATSDR Social Vulnerability Index 2022 (Agency for Toxic Substances and Disease Registry). A percentile rank among U.S. tracts: higher means more vulnerable. Built from ACS 2018-2022.'
for (const [id, v, label, note] of [
  ['svi', 'SVI', 'Social vulnerability, overall (CDC/ATSDR SVI 2022, percentile rank 0–100)', 'Percentile rank among all U.S. tracts: 90 means more vulnerable than 90 percent of them.'],
  ['svi-1', 'SVI1', 'Social vulnerability: socioeconomic status (SVI 2022, percentile rank)', 'Poverty, unemployment, housing cost burden, education and health insurance.'],
  ['svi-2', 'SVI2', 'Social vulnerability: household characteristics (SVI 2022, percentile rank)', 'Age, disability, single-parent households and English proficiency.'],
  ['svi-3', 'SVI3', 'Social vulnerability: racial and ethnic minority status (SVI 2022, percentile rank)', 'Share of people who are not non-Hispanic White. The Index treats this as a theme of its own.'],
  ['svi-4', 'SVI4', 'Social vulnerability: housing type and transportation (SVI 2022, percentile rank)', 'Multi-unit and mobile-home housing, crowding, households without a vehicle, group quarters.'],
]) {
  MEASURES.push({ id, label, dataset: 'svi-2022', table: 'SVI', unit: 'index', ramp: 'YlOrRd', est: [v], levels: ['tract'], extra: true, group: 'Vulnerability and access', credit: SVI_CREDIT, note })
}

const FOOD_CREDIT = 'Food access: USDA Economic Research Service, Food Access Research Atlas, 2025 SNAP-authorized Retailer Access Map (driving distance). Low access means more than 1 mile (urban) or 10 miles (rural) from a SNAP-authorized food store.'
MEASURES.push(
  { id: 'food-low-access', label: 'People with low access to a SNAP-authorized food store (1 mile urban, 10 miles rural)', dataset: 'food-access-2025', table: 'FA', unit: 'percent', ramp: 'Oranges', est: ['LAPOP'], den: 'POP', levels: ['tract'], extra: true, group: 'Vulnerability and access', credit: FOOD_CREDIT, note: 'Share of the tract’s 2020 population living beyond 1 mile (urban) or 10 miles (rural) of a SNAP-authorized food store, by driving distance.' },
  { id: 'food-low-income-low-access', label: 'Low-income people with low access to a SNAP-authorized food store', dataset: 'food-access-2025', table: 'FA', unit: 'percent', ramp: 'Oranges', est: ['LALOWI'], den: 'LOWI', levels: ['tract'], extra: true, group: 'Vulnerability and access', credit: FOOD_CREDIT, note: 'Low-income people with low access, as a share of the tract’s low-income people.' },
)

const OPP_CREDIT = 'Opportunity: Opportunity Insights, The Opportunity Atlas (Chetty, Friedman, Hendren, Jones and Porter 2018): children born 1978-1983 whose parents were at the 25th income percentile, by the tract they grew up in. 2010 tracts; a tract redrawn in 2020 has no value.'
MEASURES.push(
  { id: 'opportunity-rank', label: 'Household income rank in adulthood, children from low-income families (Opportunity Atlas, 0–100)', dataset: 'opportunity-2018', table: 'OA', unit: 'index', ramp: 'Greens', est: ['RANK'], levels: ['tract'], extra: true, group: 'Vulnerability and access', credit: OPP_CREDIT, note: 'Average household income rank (about age 35) of children who grew up here with parents at the 25th income percentile. On 2010 tracts: tracts redrawn in 2020 have no value.' },
  { id: 'opportunity-jail', label: 'Incarceration rate in adulthood, children from low-income families (Opportunity Atlas)', dataset: 'opportunity-2018', table: 'OA', unit: 'percent', ramp: 'Oranges', est: ['JAIL'], levels: ['tract'], extra: true, group: 'Vulnerability and access', credit: OPP_CREDIT, note: 'Share of children who grew up here with parents at the 25th income percentile who were in jail or prison on a given day in 2010. On 2010 tracts.' },
)

MEASURES.push({
  id: 'walkability',
  label: 'Walkability (EPA National Walkability Index, 1–20)',
  dataset: 'walkability-2021',
  table: 'WI',
  unit: 'index',
  ramp: 'Purples',
  est: ['NWI'],
  levels: ['blockgroup'],
  extra: true,
  group: 'Vulnerability and access',
  credit: 'Walkability: U.S. EPA, Smart Location Database version 3.0 (2021), National Walkability Index. Block groups are the 2019 ones; a block group redrawn since has no value.',
  note: '1 (least walkable) to 20 (most walkable), from intersection density, distance to transit and the mix of jobs and housing. On 2019 block groups.',
})

const EVICTION_CREDIT = 'Evictions: Princeton University Eviction Lab, Estimating Eviction Prevalence across the United States (Gromis, Fellows, Hendrickson, Edmonds, Leung, Porton and Desmond; 2022). Observed, validated counts only.'
for (const [id, v, label] of [
  ['eviction-filings', 'FIL_2016', 'Eviction filings per 100 renter households, 2016 (Eviction Lab)'],
  ['eviction-threatened', 'THR_2016', 'Households threatened with eviction per 100 renter households, 2016 (Eviction Lab)'],
  ['eviction-judgements', 'JUD_2016', 'Eviction judgements per 100 renter households, 2016 (Eviction Lab)'],
]) {
  MEASURES.push({ id, label, dataset: 'eviction-2018', table: 'EV', unit: 'per100', ramp: 'YlOrRd', est: [v], levels: ['county'], extra: true, group: 'Housing and evictions', credit: EVICTION_CREDIT, note: 'A county shows only where the Eviction Lab could validate its court records, about 1,300 of 3,100 counties in 2016 (the year with the most; coverage thins to about 900 by 2018). The data hold 2000 to 2018.' })
}

// The Census Bureau's annual population estimates (Vintage 2025): newer than the 2020 census and the ACS, for states,
// counties, towns and townships, and incorporated places.
const PEP_CREDIT = 'Population estimates: U.S. Census Bureau, Population Estimates Program, Vintage 2025 (July 1 estimates of the resident population). Estimates, not counts; towns and places show total population only, and census-designated places are not estimated.'
const PEP_LEVELS = ['state', 'county', 'cousub', 'place']
const PEP = { dataset: 'pep-2025', extra: true, group: 'Population estimates (Census PEP)', credit: PEP_CREDIT }
MEASURES.push(
  { ...PEP, id: 'pep2025', label: 'Population estimate, July 1, 2025 (Census Population Estimates)', table: 'POP', unit: 'count', ramp: 'Blues', est: ['POP2025'], levels: PEP_LEVELS, note: 'The Bureau’s annual estimate, built from the 2020 census and births, deaths and migration. Newer than the ACS.' },
  { ...PEP, id: 'pep-change', label: 'Population change since April 2020, percent (Census Population Estimates)', table: 'POP', unit: 'percent', ramp: 'Greens', est: ['PCT'], levels: PEP_LEVELS, note: 'July 1, 2025 estimate compared with the April 2020 estimates base.' },
  { ...PEP, id: 'pep-change-count', label: 'People gained or lost since April 2020 (Census Population Estimates)', table: 'POP', unit: 'count', ramp: 'Greens', est: ['CHG'], levels: PEP_LEVELS, note: 'July 1, 2025 estimate minus the April 2020 estimates base.' },
  { ...PEP, id: 'pep-natural', label: 'Natural increase, births minus deaths, July 2024 to June 2025 (counties)', table: 'COMP', unit: 'count', ramp: 'Greens', est: ['NAT2025'], levels: ['county'], note: 'Births minus deaths in the year to July 1, 2025.' },
  { ...PEP, id: 'pep-international', label: 'International migration, July 2024 to June 2025 (counties)', table: 'COMP', unit: 'count', ramp: 'Purples', est: ['INTL2025'], levels: ['county'], note: 'Net international migration in the year to July 1, 2025.' },
  { ...PEP, id: 'pep-domestic', label: 'Domestic migration, July 2024 to June 2025 (counties)', table: 'COMP', unit: 'count', ramp: 'Purples', est: ['DOM2025'], levels: ['county'], note: 'Net movement between counties of the United States in the year to July 1, 2025.' },
)

// Crimes reported to the police, from the FBI's Crime in the United States, Table 8 (city and town departments).
const CRIME_CREDIT = 'Crime: FBI Uniform Crime Reporting Program, Crime in the United States (Table 8, offenses known to law enforcement by state by city), via the Crime Data Explorer. Crimes reported to police by the department that serves the place, not all crime; rates are per 100,000 residents. The FBI cautions against ranking places by these numbers.'
const CRIME_NOTE = `${CRIME_WARNING_SHORT} A department that sent little to the FBI shows a low number (check the reporting check on the place profile); limited data were available for some states in some years.`
for (const year of [2024, 2025]) {
  for (const [id, prefix, label] of [
    ['violent', 'VR', 'Violent crime reported to police'],
    ['property', 'PR', 'Property crime reported to police'],
    ['murder', 'MR', 'Murder and nonnegligent manslaughter reported to police'],
  ]) {
    MEASURES.push({ id: `crime-${id}-${year}`, label: `${label}, ${year} (per 100,000, FBI)`, dataset: 'cius-2025', table: 'CR', unit: 'per100k', ramp: 'YlOrRd', est: [`${prefix}_${year}`], levels: ['place', 'cousub'], extra: true, group: 'Crime (FBI Uniform Crime Reporting)', credit: CRIME_CREDIT, note: CRIME_NOTE })
  }
}

// Police employees per 1,000 residents, from the FBI's Law Enforcement Employees data (2000 to 2025).
const POLICE_CREDIT = 'Police employees: FBI Uniform Crime Reporting Program, Law Enforcement Employees data (Crime Data Explorer). Employees of city and county police agencies per 1,000 residents of the population they serve; agencies that did not report are absent.'
for (const year of [2019, 2025]) {
  MEASURES.push({ id: `police-per-1000-${year}`, label: `Police employees per 1,000 residents, ${year} (FBI)`, dataset: 'police-employees', table: 'PE', unit: 'per1000', ramp: 'Blues', est: [`PER_${year}`], levels: ['place', 'cousub', 'county'], extra: true, group: 'Policing (FBI Uniform Crime Reporting)', credit: POLICE_CREDIT, note: 'Officers and civilian employees of the city or county police department that serves the area. A county adds every city and county agency in it. Cities near other cities, college police and state police are not part of a place’s figure.' })
}
MEASURES.push({ id: 'police-coverage-2025', label: 'Share of the county’s population served by the police agencies counted, 2025 (FBI)', dataset: 'police-employees', table: 'PE', unit: 'percent', ramp: 'Greens', est: ['COV_2025'], levels: ['county'], extra: true, group: 'Policing (FBI Uniform Crime Reporting)', credit: POLICE_CREDIT, note: 'The population the city and county agencies say they serve, as a percent of the county’s own. Near 100 means the county’s agencies are all counted; far below means agencies are missing; above 100 means jurisdictions overlap or populations are counted twice.' })

// How much each police department sent the FBI in the incident-based system: a screen for thin reporting, not a measure of crime.
const NIBRS_CREDIT = 'Reporting: FBI Uniform Crime Reporting Program, NIBRS incident-based data by state (Crime Data Explorer). Counts what a department submitted in the incident-based system; a department that reports in the older summary system is not counted here.'
const NIBRS_NOTE = 'A screen for thin reporting, not a measure of crime. A place that sends far fewer incidents per 1,000 residents than similar places probably sent little, and its crime numbers will look low. A month with a submission can still hold almost no incidents.'
MEASURES.push(
  { id: 'nibrs-incidents-per-1000-2025', label: 'Incidents sent to the FBI per 1,000 residents, 2025 (reporting check)', dataset: 'nibrs-reporting', table: 'NR', unit: 'per1000', ramp: 'Blues', est: ['IPK_2025'], levels: ['place', 'cousub'], extra: true, group: 'Crime (FBI Uniform Crime Reporting)', credit: NIBRS_CREDIT, note: NIBRS_NOTE },
  { id: 'nibrs-months-2025', label: 'Months of 2025 with a submission to the FBI (reporting check)', dataset: 'nibrs-reporting', table: 'NR', unit: 'count', ramp: 'Greens', est: ['MON_2025'], levels: ['place', 'cousub'], extra: true, group: 'Crime (FBI Uniform Crime Reporting)', credit: NIBRS_CREDIT, note: NIBRS_NOTE },
)

// County totals: every agency in the county added up by the county it states. Incidents reported, not crimes in the county.
const NIBRS_COUNTY_CREDIT = 'Source: FBI Uniform Crime Reporting Program, NIBRS incident-based data by state (Crime Data Explorer), added up by the county each agency states. Incidents reported by the agencies in the county, not all crimes in it.'
const NIBRS_COUNTY_NOTE = 'Agencies that report in the older summary system, or did not report, are absent, so read the coverage measure first: a county whose reporting agencies serve well under its population is incomplete. Researchers have advised against county-level UCR data for policy work (Maltz and Targonski 2002).'
MEASURES.push(
  { id: 'nibrs-county-coverage-2025', label: 'Share of the county’s population served by agencies reporting incidents, 2025 (check this first)', dataset: 'nibrs-county', table: 'NC', unit: 'percent', ramp: 'Greens', est: ['COV_2025'], levels: ['county'], extra: true, group: 'Crime (FBI Uniform Crime Reporting)', credit: NIBRS_COUNTY_CREDIT, note: NIBRS_COUNTY_NOTE + ' Above 100 means jurisdictions overlap.' },
  { id: 'nibrs-county-incidents-per-1000-2025', label: 'Incidents reported by the county’s agencies per 1,000 residents served, 2025', dataset: 'nibrs-county', table: 'NC', unit: 'per1000', ramp: 'Blues', est: ['IPK_2025'], levels: ['county'], extra: true, group: 'Crime (FBI Uniform Crime Reporting)', credit: NIBRS_COUNTY_CREDIT, note: NIBRS_COUNTY_NOTE },
  { id: 'nibrs-county-incidents-2025', label: 'Incidents reported by the county’s agencies, 2025', dataset: 'nibrs-county', table: 'NC', unit: 'count', ramp: 'Blues', est: ['INC_2025'], levels: ['county'], extra: true, group: 'Crime (FBI Uniform Crime Reporting)', credit: NIBRS_COUNTY_CREDIT, note: NIBRS_COUNTY_NOTE },
)

// County crime 1985 to 2019: the FBI's own Return A master files (offenses known to the police), added up by county by Husky Explorer.
const COUNTY_CRIME_CREDIT = 'Source: FBI Uniform Crime Reporting Program, Return A master files (offenses known to law enforcement), from the FBI’s Crime Data Explorer, added up by Husky Explorer by the county the FBI codes each agency to. U.S. federal data, in the public domain. Crimes reported to police, not all crime.'
const COUNTY_CRIME_NOTE = `${CRIME_WARNING_SHORT} These are the offenses the police agencies reported to the FBI (actual offenses: reported, less unfounded), added up by county: nothing is estimated and nothing is filled in. The coverage figure is the percent of the county’s population served by agencies that reported all twelve months; rates are shown only at 90 or above, and others are blank, not zero. A city that lies in several counties is split among them by population, and state police units with a county add to it. Agencies the FBI does not place in a county are left out (about 3 to 5 percent of crimes, mostly New York City’s: the five boroughs have no data). Coverage falls after 2016 as agencies move to incident-based reporting, so check the coverage measure before comparing years across that break. The FBI’s master files for these years are updated after the printed report, so a city’s figure can differ slightly from the one in the printed Crime in the United States. Violent crime is murder and non-negligent manslaughter, rape (the definition in use until 2013), robbery and aggravated assault. Researchers have advised against county-level UCR data for policy work (Maltz and Targonski 2002). Counties are drawn on the 2010 census boundaries, so Connecticut’s eight old counties appear as they were.`
for (let year = 1985; year <= 2019; year++) {
  MEASURES.push(
    { id: `county-violent-${year}`, label: `Violent crime in the county, ${year} (per 100,000; reported to the FBI)`, dataset: 'county-crime', table: 'CC', unit: 'per100k', ramp: 'YlOrRd', est: [`VR_${year}`], vintage: 2010, levels: ['county'], extra: true, group: 'Crime (county, 1985 to 2019)', credit: COUNTY_CRIME_CREDIT, note: COUNTY_CRIME_NOTE },
    { id: `county-index-${year}`, label: `Index crime in the county, ${year} (per 100,000; reported to the FBI)`, dataset: 'county-crime', table: 'CC', unit: 'per100k', ramp: 'YlOrRd', est: [`TR_${year}`], vintage: 2010, levels: ['county'], extra: true, group: 'Crime (county, 1985 to 2019)', credit: COUNTY_CRIME_CREDIT, note: COUNTY_CRIME_NOTE },
    { id: `county-crime-coverage-${year}`, label: `Coverage, ${year}: percent of the county’s population in agencies that reported all twelve months (check this first)`, dataset: 'county-crime', table: 'CC', unit: 'percent', ramp: 'Greens', est: [`COV_${year}`], vintage: 2010, levels: ['county'], extra: true, group: 'Crime (county, 1985 to 2019)', credit: COUNTY_CRIME_CREDIT, note: COUNTY_CRIME_NOTE },
  )
}

// Commuting, from the Census Bureau's LODES (all jobs, blocks added to counties).
const LODES_CREDIT = 'Source: U.S. Census Bureau, LEHD Origin-Destination Employment Statistics (LODES8), all jobs, 2023. Covers jobs in unemployment-insurance records and federal jobs; the self-employed are not counted.'
const LODES_NOTE = 'A job is placed at the worker’s home and work addresses on file, which can be an employer’s headquarters rather than where the person sits.'
MEASURES.push(
  { id: 'commute-out-2023', label: 'Resident workers who work outside their county, 2023', dataset: 'commuting-2023', table: 'CM', unit: 'percent', ramp: 'Purples', est: ['OUT_2023'], levels: ['county'], extra: true, group: 'Commuting (Census LODES)', credit: LODES_CREDIT, note: LODES_NOTE },
  { id: 'commute-in-2023', label: 'Jobs in the county held by commuters from outside it, 2023', dataset: 'commuting-2023', table: 'CM', unit: 'percent', ramp: 'Purples', est: ['IN_2023'], levels: ['county'], extra: true, group: 'Commuting (Census LODES)', credit: LODES_CREDIT, note: LODES_NOTE },
  { id: 'commute-net-2023', label: 'Jobs in the county minus resident workers, 2023 (job centers are positive)', dataset: 'commuting-2023', table: 'CM', unit: 'count', ramp: 'Purples', est: ['NET_2023'], levels: ['county'], extra: true, group: 'Commuting (Census LODES)', credit: LODES_CREDIT, note: LODES_NOTE },
  { id: 'commute-jobs-2023', label: 'Jobs located in the county, 2023', dataset: 'commuting-2023', table: 'CM', unit: 'count', ramp: 'Purples', est: ['JOB_2023'], levels: ['county'], extra: true, group: 'Commuting (Census LODES)', credit: LODES_CREDIT, note: LODES_NOTE },
)

// Held-back sources (terms not yet confirmed) are not offered anywhere; see lib/clearance.js.
dropHeldBack(MEASURES)
