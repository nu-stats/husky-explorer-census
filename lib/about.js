// Where to read about each data source from someone other than its publisher: encyclopedia entries, library or research-center
// guides, and the papers that describe the method. Every address here was opened when the list was written (2026-11-01); the
// publisher's own page is in the credit, so these are the second opinion. A person should look at them again from time to time.

const W = (title) => ['Wikipedia: ' + title.replaceAll('_', ' '), `https://en.wikipedia.org/wiki/${title}`]

/** Dataset id (as in lib/sources.js) to links: [label, address]. */
export const ABOUT = {
  'acs5-2024': [W('American_Community_Survey')],
  'acs5-2019': [W('American_Community_Survey')],
  'acs1-2024': [W('American_Community_Survey')],
  'dec-2020': [W('2020_United_States_census')],
  'dec-2000': [W('2000_United_States_census')],
  'dec-2010': [W('2010_United_States_census')],
  'change-2010-2020': [W('Census_tract')],
  'change-2010-2024': [W('American_Community_Survey')],
  'pep-2025': [W('Population_Estimates_Program')],
  'places-2025': [W('Behavioral_Risk_Factor_Surveillance_System')],
  'usaleep-2015': [W('Life_expectancy')],
  'epht-2022': [W('Particulates'), W('Air_quality_index')],
  'svi-2022': [W('Social_Vulnerability_Index'), W('Social_vulnerability')],
  'food-access-2025': [W('Food_desert')],
  'opportunity-2018': [['Chetty, Friedman, Hendren, Jones and Porter, “The Opportunity Atlas” (National Bureau of Economic Research working paper 25147)', 'https://www.nber.org/papers/w25147'], W('Raj_Chetty')],
  'walkability-2021': [W('Walkability')],
  'eviction-2018': [W('Eviction_Lab')],
  'wetbulb-prism': [W('Wet-bulb_temperature')],
  'era5-heat': [W('ERA5')],
  'cius-2025': [W('Uniform_Crime_Reports'), W('Dark_figure_of_crime'), ['Maltz, “Bridging Gaps in Police Crime Data” (Bureau of Justice Statistics, 1999)', 'https://bjs.ojp.gov/content/pub/pdf/bgpcd.pdf'], ['Kaplan, “UCR Program Data: An Opinionated Guide to FBI Data” (free online book)', 'https://ucrbook.com/']],
  'police-employees': [W('Uniform_Crime_Reports'), ['Kaplan, “UCR Program Data: An Opinionated Guide to FBI Data” (free online book)', 'https://ucrbook.com/']],
  'county-crime': [W('Uniform_Crime_Reports'), ['Maltz and Targonski, “A Note on the Use of County-Level UCR Data” (2002)', 'https://www.ojp.gov/ncjrs/virtual-library/abstracts/note-use-county-level-ucr-data'], ['Kaplan, “UCR Program Data: An Opinionated Guide to FBI Data” (free online book)', 'https://ucrbook.com/']],
  'nibrs-county': [W('National_Incident-Based_Reporting_System'), ['Maltz and Targonski, “A Note on the Use of County-Level UCR Data” (2002)', 'https://www.ojp.gov/ncjrs/virtual-library/abstracts/note-use-county-level-ucr-data'], ['Kaplan, “UCR Program Data: An Opinionated Guide to FBI Data” (free online book)', 'https://ucrbook.com/']],
  'commuting-2023': [W('Commuting'), W('Journey_to_work')],
  'nibrs-reporting': [W('National_Incident-Based_Reporting_System'), W('Uniform_Crime_Reports'), ['Lynch and Jarvis, “Missing Data and Imputation in the Uniform Crime Reports” (2008)', 'https://ojp.gov/ncjrs/virtual-library/abstracts/missing-data-and-imputation-uniform-crime-reports-and-effects']],
}

/** The dot layers (they are not measures, so the sources page lists them on their own). */
export const POINT_LAYERS = [
  { name: 'Public housing developments', publisher: 'U.S. Department of Housing and Urban Development', about: [W('Public_housing_in_the_United_States')] },
  { name: 'Tax-credit housing (LIHTC)', publisher: 'U.S. Department of Housing and Urban Development', about: [W('Low-Income_Housing_Tax_Credit')] },
  { name: 'Trauma centers', publisher: 'DHS / Oak Ridge National Laboratory (HIFLD hospitals)', about: [W('Trauma_center')] },
  { name: 'Toxic release reporters (TRI)', publisher: 'U.S. Environmental Protection Agency', about: [W('Toxics_Release_Inventory')] },
  { name: 'Superfund sites (NPL)', publisher: 'U.S. Environmental Protection Agency', about: [W('Superfund')] },
]
