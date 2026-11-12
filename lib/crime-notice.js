// The common warning for crime data, and the reading that stands behind it: research that identifies the limits of the data, and
// work that has used it. Every address was opened when the list was written (2026-11-01). The FBI's own statements are quoted in
// substance, not at length; read them at the source.

/** The warning, in six lines. Shown whole on the crime page and in full on every crime download; a short form sits on each crime measure. */
export const CRIME_WARNING = [
  'These numbers are crimes reported to police and recorded by one department, not all crime. Many crimes are never reported.',
  'The FBI itself cautions against ranking cities, counties or states by crime numbers: rankings ignore everything else that shapes crime in a place.',
  'A department that did not report, or reported part of a year, shows a low number. Look at the reporting check before you trust a low number.',
  'Counts depend on how police record and on definitions, which change. 2021 broke the series when agencies moved to incident-based reporting.',
  'A number belongs to a police department, not to a census area: departments overlap, and a rate divides by residents, not by everyone who is there.',
  'Small places have rates that jump from year to year on a few events. Murder is the best-measured crime; most others depend on reporting.',
]

export const CRIME_WARNING_SHORT = 'Reported crime, not all crime. The FBI cautions against ranking places by these numbers; a low number can mean little reporting. See Using crime data.'

/**
 * Research that identifies limits of the data, with a line on what each one found.
 * @type {{ cite: string, url: string, finding: string }[]}
 */
export const LIMITS = [
  {
    cite: 'Michael D. Maltz, “Bridging Gaps in Police Crime Data,” Bureau of Justice Statistics, 1999 (NCJ 176365).',
    url: 'https://bjs.ojp.gov/content/pub/pdf/bgpcd.pdf',
    finding: 'How the UCR grew, where its coverage has gaps, and how the FBI imputes for them; written from a joint FBI and BJS workshop on imputation.',
  },
  {
    cite: 'Michael D. Maltz and Joseph Targonski, “A Note on the Use of County-Level UCR Data,” Journal of Quantitative Criminology 18(3), 2002.',
    url: 'https://ojp.gov/ncjrs/virtual-library/abstracts/note-use-county-level-ucr-data',
    finding: 'County-level data have major gaps and the imputation used to fill them is inadequate and inconsistent; the authors advise against county-level UCR data for policy research, using a study of right-to-carry laws as the example.',
  },
  {
    cite: 'James P. Lynch and John P. Jarvis, “Missing Data and Imputation in the Uniform Crime Reports and the Effects on National Estimates,” Journal of Contemporary Criminal Justice 24(1), 2008 (DOI 10.1177/1043986207313028).',
    url: 'https://ojp.gov/ncjrs/virtual-library/abstracts/missing-data-and-imputation-uniform-crime-reports-and-effects',
    finding: 'The share of agencies reporting twelve months fell from 78 percent in 1992 to 65.5 percent by 2003; most missing data are agencies that reported nothing; missingness is not random.',
  },
  {
    cite: 'Cindy Barnett-Ryan, Lynn Langton and Michael Planty, “The Nation’s Two Crime Measures,” Bureau of Justice Statistics, 2014 (NCJ 246832).',
    url: 'https://www.ojp.gov/library/publications/nations-two-crime-measures',
    finding: 'The UCR counts crimes reported to police; the National Crime Victimization Survey counts victimizations whether or not reported. Each has strengths and limits, and they answer different questions.',
  },
  {
    cite: 'Janet Lauritsen and Ernesto Lopez, “When Crime Statistics Diverge,” Council on Criminal Justice, 2025.',
    url: 'https://counciloncj.org/when-crime-statistics-diverge/',
    finding: 'Where police-reported and survey-based measures agree and disagree, and why, in recent years.',
  },
  {
    cite: 'Jacob Kaplan, “Uniform Crime Reporting (UCR) Program Data: An Opinionated Guide to FBI Data” (free online book), including its chapter on county-level data.',
    url: 'https://ucrbook.com/',
    finding: 'A researcher’s working guide to each FBI data set: how it is built, what is missing, and how to use it without being misled.',
  },
  {
    cite: 'FBI, “A Word About UCR Data.”',
    url: 'https://ucr.fbi.gov/a-word-about-ucr-data',
    finding: 'The Bureau’s own statement about the limits of the figures and how they should be used.',
  },
]

/**
 * Work that has used these data, and what happened when others examined it. Listing a study here does not endorse it.
 * @type {{ cite: string, url: string, note: string }[]}
 */
export const USED_IN = [
  {
    cite: 'Steven D. Levitt, “Understanding Why Crime Fell in the 1990s: Four Factors that Explain the Decline and Six that Do Not,” Journal of Economic Perspectives 18(1), 2004.',
    url: 'https://ideas.repec.org/a/aea/jecper/v18y2004i1p163-190.html',
    note: 'An influential account of the 1990s crime decline, built on national and state UCR series.',
  },
  {
    cite: 'John R. Lott Jr. and David B. Mustard, “Crime, Deterrence, and Right-to-Carry Concealed Handguns,” Journal of Legal Studies 26(1), 1997.',
    url: 'https://www.nber.org/papers/w9336',
    note: 'Used county-level UCR data for the whole United States. The link is to the main academic reply, Ayres and Donohue (2003), which re-analyzed the same data. Maltz and Targonski (2002, above) examined the county data itself. Read both sides.',
  },
  {
    cite: 'James Alan Fox, Supplementary Homicide Reports, multiply imputed database, 1976 to 2023, Northeastern University.',
    url: 'https://cssh.northeastern.edu/crj/supplementary-homicide-reports-multiply-imputed-database-1976-2023/',
    note: 'A model of how to treat missing UCR data openly: missing agencies and variables are imputed, and the imputation is documented.',
  },
  {
    cite: 'Council on Criminal Justice, crime trends and “When Crime Statistics Diverge” (2025).',
    url: 'https://counciloncj.org/when-crime-statistics-diverge/',
    note: 'A think tank that reads UCR and survey data together, and says where they disagree.',
  },
]

/** Background reading on the sources themselves, from someone other than the FBI. */
export const BACKGROUND = [
  ['Wikipedia: Uniform Crime Reports', 'https://en.wikipedia.org/wiki/Uniform_Crime_Reports'],
  ['Wikipedia: National Incident-Based Reporting System', 'https://en.wikipedia.org/wiki/National_Incident-Based_Reporting_System'],
  ['Wikipedia: Supplementary Homicide Reports', 'https://en.wikipedia.org/wiki/Supplementary_Homicide_Reports'],
  ['Wikipedia: National Crime Victimization Survey', 'https://en.wikipedia.org/wiki/National_Crime_Victimization_Survey'],
  ['Wikipedia: Dark figure of crime', 'https://en.wikipedia.org/wiki/Dark_figure_of_crime'],
  ['Wikipedia: Youth Risk Behavior Survey (students’ self-reports of fighting, weapon carrying, bullying and dating violence)', 'https://en.wikipedia.org/wiki/Youth_Risk_Behavior_Survey'],
  ['Wikipedia: Monitoring the Future (youth self-reported substance use)', 'https://en.wikipedia.org/wiki/Monitoring_the_Future'],
  ['Wikipedia: National Longitudinal Surveys (the NLSY97 youth cohort)', 'https://en.wikipedia.org/wiki/National_Longitudinal_Surveys'],
  ['Wikipedia: Self-report study (what young people say they did is not what police record)', 'https://en.wikipedia.org/wiki/Self-report_study'],
  ['Wikipedia: Behavioral Risk Factor Surveillance System (adults’ state surveys, including childhood experiences)', 'https://en.wikipedia.org/wiki/Behavioral_Risk_Factor_Surveillance_System'],
  ['Wikipedia: National Survey on Drug Use and Health (includes youth fighting, theft and drug-selling items)', 'https://en.wikipedia.org/wiki/National_Survey_on_Drug_Use_and_Health'],
  ['Wikipedia: American Time Use Survey (how people spend a day, including leisure computer use)', 'https://en.wikipedia.org/wiki/American_Time_Use_Survey'],
  ['Wikipedia: Gun Violence Archive', 'https://en.wikipedia.org/wiki/Gun_Violence_Archive'],
]

/**
 * What a person using these numbers should know, in plain words, from what was found building them (dated 2026-11-02). Each item says
 * what the issue is and what it means for reading a number. Everything here was checked against the files or the FBI's own tables
 * unless it says it was not.
 */
export const KNOWN_ISSUES = [
  {
    title: 'These are crimes reported to police, not all crime',
    text: 'Many crimes are never reported, and police record some differently from others. A place with more reporting can look worse than a place with the same amount of crime and less reporting.',
  },
  {
    title: 'Departments, not places',
    text: 'The FBI collects numbers from police departments. Husky Explorer matches each department to a census place or town by name. A department whose name is used twice in a state, or that matches no place, is left out rather than guessed (in 2025, 762 incident-based city departments matched no place and 157 were ambiguous). A place missing from a crime map may simply have failed to match, and a department’s numbers cover the people it serves, which are not always the same people as the place’s census population.',
  },
  {
    title: 'The 2021 break',
    text: 'The FBI stopped accepting the older summary system as the only way to report in 2021, and many departments, including very large ones, had not switched. For 2021 the Bureau published much less data than usual, and its own table lists states with limited data in several years (for 2021: California, DC, Florida, Illinois, Maryland, New Jersey, New Mexico, New York and Pennsylvania). A fall or rise across 2020 to 2022 may be a change in who reported, not in crime.',
  },
  {
    title: 'Some departments report only part of the year in the newer system',
    text: 'A department that switched mid-year sends the incident-based system only for some months. The FBI’s published tables add up the months from the old system and the new one; files built from the incident-based system alone cover only the months they hold. In Pennsylvania in 2024, Upper Merion sent 4 months to the new system and Allentown 8, and converting only those months gives between a tenth and two thirds of the published counts. Husky Explorer’s incident-based measures (the reporting check and the county totals) therefore understate a department that is still partly in the old system.',
  },
  {
    title: 'A month with a report is not a month of crime',
    text: 'Worcester, Massachusetts sent a report for all twelve months of 2024 and only 35 incidents, about 0.2 per 1,000 residents, where Boston sent about 56 and Springfield 76. Counting months alone would have called Worcester complete. Husky Explorer also compares incidents per 1,000 residents with the median place in the state and flags a department under a quarter of it. That quarter line is our own default, not an FBI rule. The flag says “probably incomplete”, never “safe”, and a real low-crime town can fall under it. We do not know why Worcester’s reporting was thin.',
  },
  {
    title: 'County totals are partial, and counties are not what researchers advise',
    text: 'County numbers add up every agency in the county that states that county, in the incident-based system only, and show what share of the county’s census population those agencies serve. Well under 100 percent means agencies are missing; over 100 means jurisdictions overlap (a city and the county sheriff, say). An agency whose county field names several counties is left out (523 in 2025). Researchers have advised against county-level crime data from this program for policy work (Maltz and Targonski, 2002).',
  },
  {
    title: 'County crime counts for 1985 to 2019 are sums of what agencies reported',
    text: 'The FBI publishes crime counts for agencies, not for counties. These county figures are Husky Explorer’s sums of the actual offenses (reported, less unfounded) that each police agency sent the FBI in its Return A master file, by the county the FBI codes the agency to. Nothing is estimated or filled in. A county’s coverage is the percent of its population served by agencies that reported all twelve months, and rates are shown only at 90 or more (our own line); an agency that sent nothing adds its population but no crimes. A city in several counties is split among them by population, and agencies that cannot be placed in a county are left out: between about 3 and 5 percent of the crimes reported each year (more in the 1980s), most of them New York City’s, because the FBI lists the New York City Police Department with no county (its one citywide figure is not split among the five boroughs, which show no county data); a few other large departments with no county in the FBI’s lists, such as Anchorage and the Connecticut and Alaska state police, are left out too. Many large agencies, including New York City, send assault totals without a weapon breakdown; aggravated assault is the total less simple assault, the FBI’s own rule. The master files are updated after the printed report each year, so a city can differ slightly from the printed table (for 2010, 93 in 100 cities match the printed violent crime count exactly and 98 in 100 are within one percent; murder matches for 99 in 100). Statewide agencies with no county are not spread over counties. The counties are drawn on the 2010 census boundaries for every year, so Connecticut’s eight old counties appear as they were and a county renamed or merged since 2010 is not followed. Coverage falls after 2016 (about 81 to 87 percent of the population has agencies reporting all twelve months in 2017 to 2019, against 95 percent or more in 2011 to 2016) as agencies move from the summary system to the incident-based system and stop sending monthly returns, so read the coverage figure before comparing years across that break. Researchers advise against using county-level UCR data for policy decisions (Maltz and Targonski 2002).',
  },
  {
    title: 'Incident-based and summary counts are counted differently',
    text: 'The old summary system counted only the most serious offense in an incident; the newer system counts every offense. So a switch can make crime look higher with no more crime. The FBI converts the newer data back to the old basis for its published tables. Husky Explorer has an experimental converter that follows the FBI’s published rules; for 2024 it matched the FBI’s published violent-crime counts for nearly every city agency in the 46 states tested: 100 percent of agencies within five percent in most of them (89 percent in Pennsylvania, 96 in New York), and property crime 98 to 100 percent except in Pennsylvania (85) and New York (97). The misses are agencies that sent part of the year. The converter is not yet shown on any page, and has been tested for 2023 and 2024 only.',
  },
  {
    title: 'Three crime sources are not here, and why',
    text: 'Supplementary Homicide Reports (details of each homicide) are not included: the FBI’s file has no record layout we can read, and guessing would give plausible but wrong counts. Assaults on police officers are not included: the file’s totals are about ten times the FBI’s published figures and its officers-killed columns are empty, so we cannot say what it counts. Agency-level data before 2020 is not included yet either. If you need homicide counts, use the FBI’s published tables or CDC death data, not a total from here.',
  },
  {
    title: 'Missing files and the build date',
    text: 'The data were built on 1 November 2026 from the FBI’s files and the FBI revises them. A state-year the FBI did not publish in the incident-based form is absent, not zero. Until 1 November 2026 a fault in our reader skipped every state’s 2023 incident-based file; it is fixed, and the 2025 figures shown on the place profile were never affected.',
  },
  {
    title: 'Commuting data (not crime) has its own limits',
    text: 'The Commuting page uses Census LODES jobs for 2023: it leaves out the self-employed, places a job at the address on file (often a company’s headquarters rather than where the person works), and has no 2023 file for Alaska, Michigan or Puerto Rico, so their neighbors’ numbers leave out people who commute in. Connecticut’s old counties are listed in the tables but not drawn, and only each county’s 25 largest destinations are kept.',
  },
]
