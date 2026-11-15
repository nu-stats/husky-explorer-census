import { ABOUT } from './about.js'

// The data sources page: every measure the app shows, with where it comes from, where it exists, on whose boundaries,
// how it was made, and how to credit it. Generated from the measures list, so it cannot drift from what the app does.

/**
 * What each dataset is. `kind` says how the numbers were made, in plain words; `boundaries` which areas they describe.
 * @type {Record<string, { name: string, publisher: string, kind: string, boundaries: string, terms: string }>}
 */
export const DATASETS = {
  'acs5-2024': { name: 'American Community Survey 5-year, 2020–2024', publisher: 'U.S. Census Bureau', kind: 'Survey estimates with margins of error (90 percent)', boundaries: '2024 boundaries (2020 census geography)', terms: 'U.S. Government work, free to use. Wherever Census data reaches a person the notice must show: “This product uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau.”' },
  'pep-2025': { name: 'Population Estimates, Vintage 2025', publisher: 'U.S. Census Bureau, Population Estimates Program', kind: 'Estimates of the resident population on July 1 (not counts); towns and places show total population only', boundaries: '2025 boundaries; incorporated places and towns only, not census-designated places', terms: 'U.S. Government work, free to use; credit the Census Bureau Population Estimates Program.' },
  'cius-2025': { name: 'Crime in the United States, offenses known to law enforcement by city (Table 8), 2020 to 2025', publisher: 'FBI Uniform Crime Reporting Program, via the Crime Data Explorer', kind: 'Crimes reported to police by the department that serves the place (not all crime); limited data for some states in some years; a department that reported part of the year shows a low number', boundaries: 'Cities and towns matched to census places and towns by name', terms: 'U.S. Government work, free to use with credit. The FBI cautions against ranking places by crime counts or rates.' },
  'police-employees': { name: 'Law Enforcement Employees, 2000 to 2025', publisher: 'FBI Uniform Crime Reporting Program, via the Crime Data Explorer', kind: 'Counts of police employees by agency over the population each agency serves; agencies that did not report are absent', boundaries: 'City and county agencies matched to places, towns and counties by name; a county adds every local agency whose county is stated', terms: 'U.S. Government work, free to use with credit.' },
  'county-crime': { name: 'County crime, 1985 to 2019', publisher: 'FBI Uniform Crime Reporting Program (Return A master files, Crime Data Explorer), added up by county by Husky Explorer', kind: 'Violent and index crimes reported to the police, by county and year, with the population the agencies serve and the percent of it in agencies that reported all twelve months; nothing is estimated', boundaries: 'Counties of the 2010 census (Connecticut’s eight old counties as they were)', terms: 'U.S. federal data, public domain: credit the FBI. The county totals are Husky Explorer’s own sums of the agencies’ reports.' },
  'nibrs-county': { name: 'NIBRS incidents added up by county, with coverage', publisher: 'FBI Uniform Crime Reporting Program, via the Crime Data Explorer', kind: 'Incidents reported in the incident-based system by every agency in a county, over the population those agencies serve, with the share of the county they cover', boundaries: 'Each agency’s stated county; an agency naming several counties is left out, never split', terms: 'U.S. Government work, free to use with credit.' },
  'commuting-2023': { name: 'Commuting by county (LODES, 2023)', publisher: 'U.S. Census Bureau, Longitudinal Employer-Household Dynamics', kind: 'Jobs by home and work county from administrative records: workers, jobs, and the shares who cross the county line', boundaries: 'Census blocks added up to counties', terms: 'Census Bureau data, free to use with credit.' },
  'nibrs-reporting': { name: 'NIBRS reporting: months, incidents and incidents per 1,000 residents', publisher: 'FBI Uniform Crime Reporting Program, via the Crime Data Explorer', kind: 'Counts of what each department submitted in the incident-based system (a reporting screen, not a measure of crime)', boundaries: 'City agencies matched to places and towns by name', terms: 'U.S. Government work, free to use with credit.' },
  'acs5-2019': { name: 'American Community Survey 5-year, 2015–2019', publisher: 'U.S. Census Bureau', kind: 'Survey estimates with margins of error (90 percent)', boundaries: '2019 boundaries; tracts were redrawn in 2020, so only states, counties, towns and places are used', terms: 'As the 2020–2024 ACS.' },
  'acs1-2024': { name: 'American Community Survey 1-year, 2024', publisher: 'U.S. Census Bureau', kind: 'Survey estimates with wider margins of error', boundaries: '2024 boundaries; only areas of 65,000 people or more are published', terms: 'As the 5-year ACS.' },
  'dec-2020': { name: '2020 Census', publisher: 'U.S. Census Bureau', kind: 'A count (a full count, with some noise added by the Bureau to protect privacy)', boundaries: '2020 boundaries', terms: 'As the ACS.' },
  'dec-2000': { name: '2000 Census', publisher: 'U.S. Census Bureau', kind: 'A full count (Summary File 1)', boundaries: '2000 boundaries (tracts and block groups were redrawn in 2010 and 2020)', terms: 'As the ACS.' },
  'dec-2010': { name: '2010 Census', publisher: 'U.S. Census Bureau', kind: 'A full count', boundaries: '2010 boundaries (tracts and block groups were redrawn since)', terms: 'As the ACS.' },
  'change-2010-2020': { name: 'Change between the 2010 and 2020 censuses', publisher: 'Computed here from U.S. Census Bureau counts and block relationship files', kind: 'Estimated for tracts (2010 counts carried onto 2020 tracts, after Logan, Xu and Stults 2014); direct for counties', boundaries: '2020 boundaries', terms: 'As the ACS. The tract values are Husky Explorer’s estimates, not the Bureau’s.' },
  'places-2025': { name: 'CDC PLACES', publisher: 'Centers for Disease Control and Prevention', kind: 'Model-based estimates from the Behavioral Risk Factor Surveillance System, not a count', boundaries: '2020 boundaries', terms: 'U.S. Government work; credit CDC PLACES.' },
  'usaleep-2015': { name: 'USALEEP life expectancy, 2010–2015', publisher: 'National Center for Health Statistics, with NAPHSIS and the Robert Wood Johnson Foundation', kind: 'Estimates with standard errors', boundaries: '2010 tracts; a tract redrawn in 2020 has no value', terms: 'U.S. Government work; credit NCHS.' },
  'epht-2022': { name: 'CDC Environmental Public Health Tracking: air quality and park access', publisher: 'Centers for Disease Control and Prevention', kind: 'Modeled estimates', boundaries: 'Tracts and counties as published', terms: 'U.S. Government work; credit the CDC Tracking Network.' },
  'svi-2022': { name: 'Social Vulnerability Index 2022', publisher: 'CDC/ATSDR Geospatial Research, Analysis, and Services Program', kind: 'A percentile rank among tracts, built from ACS 2018–2022', boundaries: '2020 tracts', terms: 'U.S. Government work; credit CDC/ATSDR.' },
  'food-access-2025': { name: 'SNAP-authorized Retailer Access Map 2025 (Food Access Research Atlas)', publisher: 'USDA Economic Research Service', kind: 'Counts of people beyond a distance of a store, by driving distance', boundaries: '2020 tracts', terms: 'U.S. Government work; the download page states no terms.' },
  'opportunity-2018': { name: 'The Opportunity Atlas', publisher: 'Opportunity Insights (Chetty, Friedman, Hendren, Jones and Porter)', kind: 'Estimates for children born 1978–1983 with parents at the 25th income percentile', boundaries: '2010 tracts; a tract redrawn in 2020 has no value', terms: 'Published for research with credit. A person should confirm the license before this is published.' },
  'walkability-2021': { name: 'National Walkability Index (Smart Location Database v3)', publisher: 'U.S. Environmental Protection Agency', kind: 'An index, 1 to 20, from street layout, transit and land use', boundaries: '2019 block groups; one redrawn since has no value', terms: 'U.S. Government work; credit the EPA.' },
  'eviction-2018': { name: 'Eviction Lab: observed, validated counts', publisher: 'Princeton University Eviction Lab', kind: 'Rates from court records, for counties the Lab could validate', boundaries: 'Counties', terms: 'Cite Gromis, Fellows, Hendrickson, Edmonds, Leung, Porton and Desmond (2022). No license text was found; a person should confirm before this is published.' },
  'wetbulb-prism': { name: 'Estimated wet-bulb temperature, May–September', publisher: 'Computed here from PRISM daily grids (PRISM Group, Oregon State University)', kind: 'Estimated by Husky Explorer, not measured or published by PRISM', boundaries: '2020 tracts, counties and states', terms: 'PRISM data may be reproduced with credit to the PRISM Group, its URL and the access date. Not recommended for very long-term trends.' },
  'era5-heat': { name: 'Daily county heat measures from ERA5-Land', publisher: 'Spangler, Liang and Wellenius (2022), figshare', kind: 'Modeled, population-weighted to counties', boundaries: 'Counties', terms: 'CC BY 4.0: credit the authors.' },
  upload: { name: 'Your own file', publisher: 'You', kind: 'Whatever your file holds', boundaries: 'Whatever your file’s IDs describe', terms: 'Stays in your browser; nothing is sent anywhere.' },
}

/**
 * One row per measure, grouped as the app groups them.
 * @param {{ id: string, label: string, dataset: string, group?: string, levels?: string[], vintage?: number, unit: string, credit?: string, note?: string, upload?: boolean }[]} measures
 * @param {{ id: string, label: string, source: string, levels: string[], years: number[], estimated: boolean, group: string }[]} [heat] the Heat over time page's measures
 * @param {Record<string, string>} levelNames
 */
export function catalogRows(measures, heat = [], levelNames = {}) {
  const levelsText = (levels) => (levels ? levels.map((l) => levelNames[l] ?? l).join(', ') : 'all levels it is built for')
  const rows = []
  for (const m of measures) {
    if (m.upload) continue
    const d = DATASETS[m.dataset]
    rows.push({
      group: m.group ?? 'Census tables',
      id: m.id,
      measure: m.label,
      source: d?.name ?? m.dataset,
      publisher: d?.publisher ?? '',
      where: levelsText(m.levels),
      boundaries: m.vintage === 2010 || m.vintage === 2000 ? `${m.vintage} boundaries` : (d?.boundaries ?? ''),
      kind: d?.kind ?? '',
      credit: m.credit ?? d?.terms ?? '',
      terms: d?.terms ?? '',
      note: m.note ?? '',
      about: ABOUT[m.dataset] ?? [],
    })
  }
  for (const m of heat) {
    const d = DATASETS[m.source === 'prism' ? 'wetbulb-prism' : 'era5-heat']
    rows.push({
      group: `Heat over time: ${m.group}`,
      id: `heat:${m.id}`,
      measure: m.label,
      source: d.name,
      publisher: d.publisher,
      where: levelsText(m.levels),
      boundaries: d.boundaries,
      kind: m.estimated ? 'Estimated here (marked ≈)' : d.kind,
      credit: d.terms,
      terms: d.terms,
      note: `${m.years[0]}–${m.years[1]}`,
      about: ABOUT[m.source === 'prism' ? 'wetbulb-prism' : 'era5-heat'] ?? [],
    })
  }
  return rows
}

/** CSV of the catalog for download. */
export function catalogCsv(rows) {
  const cols = [['group', 'Group'], ['measure', 'Measure'], ['source', 'Source'], ['publisher', 'Publisher'], ['where', 'Where it exists'], ['boundaries', 'Boundaries'], ['kind', 'What kind of number'], ['terms', 'Terms and credit'], ['note', 'Note']]
  const cell = (x) => (/[",\n\r]/.test(String(x)) ? `"${String(x).replaceAll('"', '""')}"` : String(x))
  return [cols.map(([, h]) => h).join(','), ...rows.map((r) => cols.map(([k]) => cell(r[k] ?? '')).join(','))].join('\r\n') + '\r\n'
}

/** The four rules the app follows about other people's data, written for a reader. */
export const RULES = [
  ['Ideas are free; expression is not.', 'The features here are built from published descriptions of what such tools do. Nothing is copied from another product: no code, layouts, text, icons or names.'],
  ['Data comes from its publisher.', 'Every number is fetched from the agency or institution that publishes it, not from a company that redisplays it. Where a company’s own terms forbid reuse, we do not use its data.'],
  ['Proprietary data stays out.', 'Licensed vendor data (market and demographic estimates and projections sold by data companies) is not used. Where a free public source does the job, that is used and said so.'],
  ['Public data still has terms.', 'U.S. Government data is free but often needs a credit or notice, and those travel with every download. University and nonprofit data ask for a citation, and some forbid redistribution: we fetch those at build time, cite them, and do not mirror them in the repository.'],
]

/**
 * Data held elsewhere that Husky Explorer links to but does not copy: their terms forbid redistribution or say nothing.
 * Each link was read from the publisher's own page (or a library guide) when this list was made; none is fetched by the app.
 */
export const RELATED = [
  {
    name: 'IPUMS NHGIS (census time series on matching boundaries)',
    what: 'Census counts for 1990, 2000, 2010 and 2020 on 2010 boundaries, from the University of Minnesota. Not in Husky Explorer yet; planned.',
    links: [
      ['NHGIS', 'https://www.nhgis.org/'],
      ['Register for a free IPUMS account', 'https://uma.pop.umn.edu/nhgis/user/new'],
    ],
    terms: 'Before you can reach NHGIS data through this tool you need a free IPUMS user account and your own API key. Registration is free; the data is fetched with your key and is never stored in or shared from this project. NHGIS data may not be redistributed without permission. Cite it as IPUMS NHGIS, University of Minnesota, www.nhgis.org.',
  },
  {
    name: 'AP / USA TODAY / Northeastern Mass Killing Database',
    what: 'Every U.S. mass killing (four or more killed, not counting the offender, within 24 hours, any weapon) since 2006, updated as events occur.',
    links: [
      ['USA TODAY database page', 'https://www.usatoday.com/story/graphics/2026/04/20/us-mass-killings-database/89698595007/'],
      ['Northeastern (James Alan Fox)', 'https://cssh.northeastern.edu/sccj/mass-killing-database/'],
    ],
    terms: 'The Associated Press hosts the downloadable files. No terms or citation are stated on the Northeastern page; confirm on the AP’s download page before reuse.',
  },
  {
    name: 'Gun Violence Archive',
    what: 'Incident-level gun violence in the United States since 2013, including mass shootings by GVA’s own definition (four or more shot, killed or not).',
    links: [
      ['Gun Violence Archive', 'https://www.gunviolencearchive.org/'],
      ['Mass shooting reports (CSV export from a search)', 'https://www.gunviolencearchive.org/reports/mass-shooting'],
      ['Boston University RISE Lab Firearm Injury Data Hub (bulk GVA file, 2015 to April 2021)', 'https://sites.bu.edu/riselab/data-hub'],
      ['Third-party scrape, 2013 to March 2018 (permission unclear; shown for completeness)', 'https://github.com/jamesqo/gun-violence-data'],
    ],
    terms: 'GVA is copyrighted and says its data is not public domain or Creative Commons. It asks for credit and to be told of use. Link to GVA itself and cite it; copies are snapshots.',
  },
  {
    name: 'The Violence Project Mass Shooter Database',
    what: 'Mass shooters since 1966 (207 cases and more than 200 variables, as listed on its page).',
    links: [
      ['Data access (request-based)', 'https://www.theviolenceproject.org/databases/download'],
      ['Earlier release on ICPSR (study 38400)', 'https://www.icpsr.umich.edu/web/NACJD/studies/38400'],
    ],
    terms: 'Access is reviewed and limited to approved uses; a person requests it. Cite Peterson and Densley.',
  },
  {
    name: 'Supplementary Homicide Reports, multiply imputed (James Alan Fox)',
    what: 'The FBI’s Supplementary Homicide Reports, 1976 to 2023, with missing agencies and variables filled in by multiple imputation: a modeled product, not raw counts.',
    links: [['Northeastern page', 'https://cssh.northeastern.edu/crj/supplementary-homicide-reports-multiply-imputed-database-1976-2023/']],
    terms: 'Confirm terms with the author before any use; never mixed with raw FBI counts.',
  },
  {
    name: 'FBI Uniform Crime Reporting data and its archive copies',
    what: 'Crime Data Explorer downloads and API; the National Archive of Criminal Justice Data’s yearly studies of Supplementary Homicide Reports and police employee (LEOKA) data; the agency-to-census crosswalk.',
    links: [
      ['FBI Crime Data Explorer: Documents & Downloads', 'https://cde.ucr.cjis.gov/LATEST/webapp/#/pages/downloads'],
      ['Supplementary Homicide Reports, 2023 (ICPSR 39304)', 'https://www.icpsr.umich.edu/web/NACJD/studies/39304'],
      ['Police Employee (LEOKA) Data, 2024 (ICPSR 39665)', 'https://www.icpsr.umich.edu/web/NACJD/studies/39665'],
      ['Law Enforcement Agency Identifiers Crosswalk series', 'https://www.icpsr.umich.edu/web/ICPSR/series/366'],
    ],
    terms: 'FBI data may be used with credit; the archive’s studies have their own redistribution rules. See plan/crime-data-sources-check.md.',
  },
  {
    name: 'Qualitative data archives (interviews, field notes, documents)',
    what: 'Repositories that keep and share qualitative research data. Interview transcripts are rarely shared because of consent, so most holdings need registration, an access agreement or a request, and some are closed. Descriptions are the archives’ own.',
    links: [
      ['Qualitative Data Repository (Syracuse University)', 'https://qdr.syr.edu/'],
      ['UK Data Service (qualitative collections among its holdings)', 'https://ukdataservice.ac.uk/'],
      ['Finnish Social Science Data Archive', 'https://www.fsd.tuni.fi/en/'],
      ['ICPSR (study search; terms vary by study)', 'https://www.icpsr.umich.edu/'],
    ],
    terms: 'Each archive and study sets its own terms: read them on the study’s page and sign in with your own account. Husky Explorer does not copy or serve any of these holdings. Analyze downloaded material in QualCraft on your own machine.',
  },
  {
    name: 'Network data repositories (social, communication and other networks)',
    what: 'Catalogs of network datasets for teaching and research, such as friendship, email, collaboration and web-link networks. Most are not geographic; they are for network analysis rather than for the map.',
    links: [
      ['Netzschleuder network catalogue (JSON API, CSV downloads; cite the original authors)', 'https://networks.skewed.de/'],
      ['Stanford Large Network Dataset Collection (SNAP)', 'https://snap.stanford.edu/data/'],
      ['Network Repository', 'https://networkrepository.com/'],
    ],
    terms: 'Each dataset has its own license and citation; follow the one on its page. Some collections (KONECT, for one) have changed their access terms or work only over plain http, so check before relying on one.',
  },
  {
    name: 'Place-to-place links (commuting, migration and friendship ties)',
    what: 'Data on links between places. Commuting is already on the Commuting page. County-to-county migration flows from the American Community Survey exist only through the 2016–2020 release. The Social Connectedness Index measures friendship ties between counties from Facebook data.',
    links: [
      ['Census LEHD (commuting flows, LODES)', 'https://lehd.ces.census.gov/data/'],
      ['Census county-to-county migration flows', 'https://www.census.gov/topics/population/migration/guidance/county-to-county-migration-flows.html'],
      ['Social Connectedness Index (Meta Data for Good)', 'https://dataforgood.facebook.com/dfg/tools/social-connectedness-index'],
    ],
    terms: 'Census data may be used with credit. The Social Connectedness Index has its own license on Meta’s page: read it before use. It is linked here, not copied.',
  },
  {
    name: 'National Survey of Children’s Exposure to Violence (NatSCEV)',
    what: 'Telephone surveys of children and caregivers about violence, abuse and crime exposure for ages 0 to 17, from the Office of Juvenile Justice and Delinquency Prevention. It covers children under 12, which the National Crime Victimization Survey does not. National estimates only.',
    links: [
      ['NatSCEV I final report (OJP abstract)', 'https://www.ojp.gov/ncjrs/virtual-library/abstracts/national-survey-childrens-exposure-violence-natscev-i-final-report'],
      ['NatSCEV III data study (ICPSR 36523)', 'https://www.icpsr.umich.edu/web/NACJD/studies/36523'],
    ],
    terms: 'The respondent-level data are restricted: a researcher must sign a restricted data use agreement and show human-subjects review approval. They are not downloaded or mirrored here. Read the published reports at the links.',
  },
  {
    name: 'Monitoring the Future (youth self-reported substance use and delinquency)',
    what: 'A University of Michigan survey of 8th, 10th and 12th graders, with follow-up panels of the same people as adults, covering drug and alcohol use and, in some forms, delinquent behavior. National samples, not places.',
    links: [
      ['Wikipedia: Monitoring the Future', 'https://en.wikipedia.org/wiki/Monitoring_the_Future'],
      ['Panel data, 1976 to 2021, restricted (ICPSR 39223)', 'https://www.icpsr.umich.edu/web/RCMD/studies/39223/versions/V1'],
    ],
    terms: 'Not downloaded here. The panel data are restricted (a restricted data use agreement and access through ICPSR’s virtual data enclave). ICPSR’s public-use files carry ICPSR’s own conditions, which include no redistribution without ICPSR’s written agreement. We did not check the survey’s own website for published tables or which delinquency items each form asked; read those before relying on it.',
  },
  {
    name: 'National Longitudinal Survey of Youth 1997 (NLSY97), self-reported delinquency and arrests',
    what: 'A Bureau of Labor Statistics cohort of young people, first interviewed in 1997 and followed since, asked about, among other things, arrests and delinquent activity. A cohort followed over time, not a yearly snapshot, and national only. A crime-focused extract of rounds 1 to 13 is on ICPSR.',
    links: [
      ['Wikipedia: National Longitudinal Surveys', 'https://en.wikipedia.org/wiki/National_Longitudinal_Surveys'],
      ['Recidivism in the NLSY97, standalone data (ICPSR 34562)', 'https://www.icpsr.umich.edu/web/NACJD/studies/34562'],
    ],
    terms: 'ICPSR lists the public-use files of 34562 as open to anyone without a member institution, and data.gov lists the license as public domain. The files are altered where needed to protect confidentiality. Not downloaded here, and we did not check the BLS NLS Investigator terms on a BLS page.',
  },
  {
    name: 'Pathways to Desistance (serious juvenile offenders)',
    what: 'A study of 1,354 serious juvenile offenders in two places, followed from adolescence to early adulthood (2000 to 2010), with self-reports and official arrest records. Two sites only: it describes these young people, not young people generally.',
    links: [
      ['Pathways to Desistance, restricted release data (ICPSR 34605)', 'https://www.icpsr.umich.edu/web/ICPSR/studies/34605/versions/V2'],
      ['Wikipedia: Self-report study', 'https://en.wikipedia.org/wiki/Self-report_study'],
    ],
    terms: 'Restricted files need a restricted data use agreement and human-subjects review approval; some public-use files are open. Not downloaded here. Note that the Wikipedia link is about self-report studies in general, not this study.',
  },
  {
    name: 'National Youth Survey and Add Health',
    what: 'Two long-running national studies of young people that include self-reported delinquency items (the National Youth Survey; the National Longitudinal Study of Adolescent to Adult Health).',
    links: [['Wikipedia: National Longitudinal Study of Adolescent to Adult Health', 'https://en.wikipedia.org/wiki/National_Longitudinal_Study_of_Adolescent_to_Adult_Health']],
    terms: 'We could not verify access terms for either one: our search did not turn up their data pages. Check each publisher before use; Add Health is known to have restricted-use files, which we have not confirmed.',
  },
]

/**
 * Rows for the data-sources page's national-survey table, from a file the build wrote
 * (data/national/ncvs-2024.json or yrbs-<year>.json): source, year, retrieval date, geography and limits.
 */
export function nationalRows(file) {
  const m = file?.meta
  if (!m) return []
  return [
    {
      name: m.name,
      who: m.publisher,
      year: m.year,
      retrieved: m.retrieved,
      geography: m.geography,
      limits: m.limits ?? [],
      terms: m.license,
      source: m.source,
      page: m.page,
      about: m.about ?? [],
      tables: (file.tables ?? file.items ?? []).map((t) => t.title ?? t.label),
    },
  ]
}
