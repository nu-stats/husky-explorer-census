// The request box: turns a plain-English request ("obesity in Suffolk County",
// "compare Suffolk and Middlesex on income") into a request the explorer can
// carry out, and says in words what it understood so a person can confirm it
// before anything is drawn. There is no language model here: it matches words
// against the measures' names and a list of everyday synonyms, and against the
// built states' and counties' names. What it cannot tell, it leaves open.

/** Everyday words for each measure. A phrase matches when all its words appear in the request. */
export const SYNONYMS = {
  pop2024: 'population, inhabitants, populous, number of people',
  pop2020: 'population 2020, census 2020, 2020 census, population count',
  pop2000: 'population 2000, census 2000, 2000 census, 2000 population',
  pop2010: 'population 2010, census 2010, 2010 census, 2010 population',
  income: 'income, earnings, salary, wages, wealth, wealthy, rich, affluent, household income',
  poverty: 'poverty, poor, low income, below poverty, impoverished',
  renter: 'renter, rent, renting, tenant, rented, renter occupied',
  hispanic: 'hispanic, latino, latina, latinx, latine',
  bachelors: 'bachelor, bachelors, degree, college, college educated, educated, education, university',
  'foreign-born': 'foreign born, foreign, immigrant, immigrants, immigration, born abroad, born outside',
  'born-europe': 'immigrant europe, foreign europe, born europe, from europe, european immigrant',
  'born-asia': 'immigrant asia, foreign asia, born asia, from asia, asian immigrant, asia',
  'born-africa': 'immigrant africa, foreign africa, born africa, from africa, african immigrant',
  'born-latin-america': 'immigrant latin america, foreign latin america, born latin america, from latin america, latin american immigrant, immigrant mexico, immigrant caribbean',
  'pop-change-pct': 'population change, population growth, growth, grew, growing, shrinking, shrank, decline, declining, population loss, change since 2010, fastest growing, boomtown',
  'pop-change': 'people gained, people lost, population gain, gained people, lost people, added people',
  'places-obesity': 'obesity, obese, overweight, weight',
  'places-diabetes': 'diabetes, diabetic, blood sugar',
  'places-bphigh': 'high blood pressure, blood pressure, hypertension',
  'places-chd': 'heart disease, coronary, heart',
  'places-stroke': 'stroke, strokes',
  'places-casthma': 'asthma',
  'places-depression': 'depression, depressed',
  'places-mhlth': 'mental distress, mental health, mental, stress',
  'places-phlth': 'physical distress, physical health',
  'places-ghlth': 'poor health, fair health, self rated health, general health, health status, unhealthy',
  'places-csmoking': 'smoking, smoke, smokers, cigarette, cigarettes, tobacco',
  'places-lpa': 'inactive, inactivity, exercise, physical activity, sedentary',
  'places-disability': 'disability, disabled, disabilities',
  'places-access2': 'health insurance, uninsured, no insurance, insurance, coverage, insured',
  'places-foodinsecu': 'food insecurity, hungry, hunger, food insecure, food',
  'places-housinsecu': 'housing insecurity, housing insecure, eviction, evicted, unstable housing',
  'places-lacktrpt': 'transportation, transit, no car, reliable transportation, getting around',
  'places-loneliness': 'lonely, loneliness, isolation, isolated, social support',
  'life-expectancy': 'life expectancy, live longer, longevity, lifespan, life span, how long people live, mortality, death',
  'air-pm25': 'pm25, air quality, air pollution, pollution, particulate, particulates, fine particles, soot, smoke air, smog',
  'air-ozone': 'ozone, smog, air quality, air pollution, pollution',
  svi: 'social vulnerability, vulnerability, vulnerable, svi, social vulnerability index',
  'svi-1': 'socioeconomic vulnerability, socioeconomic status vulnerability',
  'svi-2': 'household vulnerability, household characteristics vulnerability',
  'svi-3': 'minority vulnerability, minority status vulnerability',
  'svi-4': 'housing transportation vulnerability, housing type vulnerability',
  'food-low-access': 'food access, food desert, food deserts, low access, supermarket, grocery, grocery store, far from food',
  'food-low-income-low-access': 'low income food access, low income low access, food desert low income',
  'opportunity-rank': 'opportunity, mobility, upward mobility, economic mobility, opportunity atlas, grew up poor',
  'opportunity-jail': 'incarceration, jail, prison, incarcerated',
  walkability: 'walkable, walkability, walk, walking, pedestrian',
  'eviction-filings': 'eviction, evictions, evicted, eviction filings, eviction rate, eviction lab',
  'eviction-threatened': 'threatened eviction, households threatened, eviction threat',
  'eviction-judgements': 'eviction judgements, eviction judgments, evicted by court',
  pep2025: 'population estimate, estimate 2025, latest population, current population, population 2025, population estimates',
  'pep-change': 'growth since 2020, population change since 2020, recent growth, recently grew, growing since 2020, shrinking since 2020, fastest growing recently',
  'pep-change-count': 'people gained since 2020, people lost since 2020, gained people since 2020, lost people since 2020',
  'pep-natural': 'natural increase, births minus deaths, more births than deaths, births and deaths',
  'pep-international': 'international migration, immigration estimate, migrants arriving',
  'pep-domestic': 'domestic migration, moving in, moving out, people moving, net migration, migration within the country',
  'crime-violent-2025': 'crime, violent crime, violent crime rate, crime rate, dangerous, safety, assaults, robberies',
  'crime-property-2025': 'property crime, burglary, theft, thefts, larceny, car theft, auto theft, break ins',
  'crime-murder-2025': 'murder, murders, homicide, homicides, murder rate, homicide rate, killings',
  'police-per-1000-2025': 'police, police officers, police staffing, police employees, officers per capita, policing, how many police',
  'police-coverage-2025': 'police coverage, agency coverage, police reporting coverage',
  'nibrs-incidents-per-1000-2025': 'reporting check, incidents reported, how much did the police report, thin reporting, data quality crime',
  'nibrs-months-2025': 'months reported, months of reporting, reporting months',
  'air-parks': 'park, parks, green space, greenspace, near a park, park access, recreation',
}

const STOP = new Set('a an and the of in on for to with by at from per as is are be show me map see what where how who which that this about data adults people percent percentage share rate number average median total'.split(' '))

/** Lowercase words with punctuation gone and plurals folded, so "renters" and "renter" meet. */
export function words(text) {
  const t = String(text)
    .toLowerCase()
    .replace(/pm\s*-?\s*2\.?5/g, 'pm25')
    .replace(/[’']s\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  return t ? t.split(' ').map(stem) : []
}

function stem(w) {
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y'
  if (w.length > 3 && w.endsWith('s') && !/(ss|us|is)$/.test(w)) return w.slice(0, -1)
  return w
}

/**
 * The measures a request could mean, best first. A measure scores the length of
 * its longest matching phrase, so "immigrants from Asia" prefers the Asia
 * measure (two words) over plain foreign-born (one). Ties keep the list's order.
 * @param {string} text
 * @param {{ id: string, label: string }[]} measures
 * @returns {{ measure: object, score: number }[]}
 */
export function findMeasures(text, measures) {
  const have = new Set(words(text))
  const out = []
  measures.forEach((measure, order) => {
    let score = 0
    for (const phrase of (SYNONYMS[measure.id] ?? '').split(',')) {
      const w = words(phrase)
      if (w.length && w.every((x) => have.has(x))) score = Math.max(score, w.length)
    }
    // A word of the measure's own name counts a little: "income" finds "Median household income".
    const own = words(measure.label).filter((w) => !STOP.has(w) && w.length > 3 && have.has(w)).length
    if (score === 0 && own > 0) score = 0.5
    if (score > 0) out.push({ measure, score: score + own * 0.01, order })
  })
  return out.sort((a, b) => b.score - a.score || a.order - b.order).map(({ measure, score }) => ({ measure, score }))
}

const PLACE_SUFFIX = /\s+(county|parish|borough|census area|municipality|city and borough)$/i

/** "Suffolk County, Massachusetts" -> "suffolk". */
export function baseName(countyName) {
  return words(countyName.split(',')[0].replace(PLACE_SUFFIX, '')).join(' ')
}

/**
 * Finds the states and counties a request names. A county is found by its
 * name; the same name in two states ("Washington") comes back as several
 * candidates, left for the person to choose unless a state is also named.
 * @param {string} text
 * @param {{ fips: string, name: string }[]} states built states
 * @param {{ geoid: string, name: string }[]} counties counties of the built states
 */
export function findPlaces(text, states, counties) {
  const typed = ' ' + words(text).join(' ') + ' '
  let rest = typed
  const found = { states: [], counties: [] }
  // County names first, when written with the word "county", since a few are also state names ("New York County").
  const bases = counties.map((c) => ({ c, base: baseName(c.name) })).filter((x) => x.base)
  bases.sort((a, b) => b.base.length - a.base.length)
  const taken = new Set()
  for (const { c, base } of bases) {
    if (rest.includes(` ${base} county `) || rest.includes(` ${base} parish `) || rest.includes(` ${base} borough `)) {
      if (!taken.has(c.geoid)) found.counties.push({ ...c, base })
      taken.add(c.geoid)
    }
  }
  for (const base of new Set(found.counties.map((c) => c.base))) rest = rest.replaceAll(` ${base} county `, ' ').replaceAll(` ${base} parish `, ' ').replaceAll(` ${base} borough `, ' ')
  // States, longest name first so "west virginia" is not read as "virginia".
  const named = states.map((s) => ({ s, base: words(s.name).join(' ') })).sort((a, b) => b.base.length - a.base.length)
  for (const { s, base } of named) {
    if (rest.includes(` ${base} `)) {
      found.states.push(s)
      rest = rest.replaceAll(` ${base} `, ' ')
    }
  }
  // Bare county names ("Suffolk"), once the states are out of the way.
  for (const { c, base } of bases) {
    if (!taken.has(c.geoid) && rest.includes(` ${base} `)) {
      found.counties.push({ ...c, base })
      taken.add(c.geoid)
    }
  }
  // A state named in the request narrows counties whose name is shared.
  if (found.states.length) {
    const wanted = new Set(found.states.map((s) => s.fips))
    const byBase = Map.groupBy(found.counties, (c) => c.base)
    found.counties = [...byBase.values()].flatMap((group) => {
      const inNamed = group.filter((c) => wanted.has(c.geoid.slice(0, 2)))
      return inNamed.length ? inNamed : group
    })
  }
  // In the order they were written, which is the order of a comparison.
  found.counties.sort((a, b) => typed.indexOf(` ${a.base} `) - typed.indexOf(` ${b.base} `))
  return { ...found, leftover: rest }
}

/** The kind of area asked for, from words left after the place names are removed. */
export function findLevel(leftover) {
  const t = ' ' + leftover.trim() + ' '
  if (/ block group /.test(t)) return 'blockgroup'
  if (/ (tract|neighborhood|neighbourhood) /.test(t)) return 'tract'
  if (/ county /.test(t)) return 'county'
  if (/ (towns|townships|municipalities) /.test(t)) return 'cousub'
  if (/ (zip|zips|zip codes?|zcta|zctas) /.test(t)) return 'zcta'
  if (/ (cities|places) /.test(t)) return 'place'
  return null
}

const COMPARE_WORDS = /\b(compare|compared|comparison|versus|vs|against|difference|differ|differs|side by side)\b/

/**
 * @typedef {{
 *   action: 'map' | 'compare', measureId: string | null, state: string | null,
 *   counties: string[], level: 'auto' | 'county' | 'cousub' | 'zcta' | 'place' | 'tract' | 'blockgroup',
 * }} Request
 */

/**
 * Reads a typed request.
 * @param {string} text
 * @param {{ measures: object[], states: { fips: string, name: string }[], counties: { geoid: string, name: string }[] }} world
 * @returns {{ request: Request, alternatives: object[], ambiguous: { geoid: string, name: string }[][], understood: boolean }}
 */
export function interpret(text, world) {
  const found = findMeasures(text, world.measures)
  const places = findPlaces(text, world.states, world.counties)
  const level = findLevel(places.leftover)
  // Counties that share a name across states stay open (grouped) until chosen.
  const groups = Map.groupBy(places.counties, (c) => c.base)
  const ambiguous = [...groups.values()].filter((g) => g.length > 1).map((g) => g.map(({ geoid, name }) => ({ geoid, name })))
  const sure = [...groups.values()].filter((g) => g.length === 1).map((g) => g[0].geoid)
  const state = places.states[0]?.fips ?? sure[0]?.slice(0, 2) ?? null
  const wantsCompare = COMPARE_WORDS.test(String(text).toLowerCase()) || sure.length + ambiguous.length >= 2
  const request = {
    action: wantsCompare && sure.length + ambiguous.length >= 2 ? 'compare' : 'map',
    measureId: found[0]?.measure.id ?? null,
    state,
    counties: sure.slice(0, 3),
    level: level ?? 'auto',
  }
  const best = found[0]?.score ?? 0
  const alternatives = found.slice(1, 4).filter((f) => f.score >= best * 0.5).map((f) => f.measure)
  return { request, alternatives, ambiguous, understood: found.length > 0 }
}

const LEVEL_WORDS = { auto: '', county: 'counties', place: 'cities and places', cousub: 'towns and townships', zcta: 'ZIP code areas', tract: 'tracts', blockgroup: 'block groups' }
const LEVEL_ONE = { county: 'county', place: 'city or place', cousub: 'town or township', zcta: 'ZIP code area', tract: 'tract', blockgroup: 'block group' }

/**
 * Warnings about a request, in plain words. An empty list means it can be carried out as asked.
 * @param {Request} request
 * @param {{ measures: object[], built: Record<string, { name: string, levels: string[], datasets: string[] }> }} world
 */
export function check(request, world) {
  const notes = []
  const measure = world.measures.find((m) => m.id === request.measureId)
  if (!measure) {
    notes.push('I could not tell which data you want. Choose it from the Data menu.')
    return notes
  }
  if (!request.state) notes.push('Choose a state.')
  const built = request.state ? world.built[request.state] : null
  if (built && !built.datasets.includes(measure.dataset)) notes.push(`${measure.label} has not been fetched for ${built.name}. Run “Fetch data” to add it.`)
  if (request.level !== 'auto' && measure.levels && !measure.levels.includes(request.level)) {
    notes.push(`${measure.label} is only available for ${measure.levels.filter((l) => LEVEL_WORDS[l]).map((l) => LEVEL_WORDS[l]).join(' and ')}, not ${LEVEL_WORDS[request.level]}.`)
  }
  if (built && request.level !== 'auto' && !built.levels.includes(request.level)) notes.push(`${LEVEL_WORDS[request.level][0].toUpperCase() + LEVEL_WORDS[request.level].slice(1)} have not been fetched for ${built.name}. Run “Fetch data” to add them.`)
  if (request.action === 'compare' && request.counties.length < 2) notes.push('To compare, choose two or three places.')
  if (request.action === 'compare' && measure.levels && !measure.levels.includes('county')) {
    notes.push(`${measure.label} has no county values, so counties cannot be compared on it. Compare tracts from the map instead.`)
  }
  return notes
}

/**
 * What the request means, in a sentence a person can say yes or no to.
 * @param {Request} request
 */
export function describe(request, world) {
  const measure = world.measures.find((m) => m.id === request.measureId)
  const what = measure ? measure.label : 'data you choose'
  const nameOf = (geoid) => world.counties.find((c) => c.geoid === geoid)?.name
  const placeNames = request.counties.map(nameOf).filter(Boolean)
  const stateName = request.state ? world.built[request.state]?.name : null
  if (request.action === 'compare') {
    const list = placeNames.length > 1 ? placeNames.slice(0, -1).join(', ') + ' and ' + placeNames.at(-1) : placeNames[0] ?? 'places you choose'
    return `Compare ${list} on ${what}.`
  }
  const level = LEVEL_ONE[request.level] ? ` by ${LEVEL_ONE[request.level]}` : ''
  const where = placeNames[0] ?? stateName ?? 'a state you choose'
  return `Map ${what}${level}, around ${where}.`
}
