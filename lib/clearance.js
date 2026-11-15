// Which data sources a person has cleared for showing, and which are held back (greyed out, not displayed).
// A source is cleared when its terms are known and allow showing it with credit. Held-back sources stay in the repository's
// build code but no page lists or draws them. To show one again, remove it here once the terms are confirmed
// (see ATTRIBUTION.md and docs/*-email-draft.md).
// A site profile (lib/site.js, written by `build-site.ts --site`) narrows this further to the datasets it holds.
import { SITE } from './site.js'

/** @type {{ id: string, name: string, why: string }[]} Datasets (ids as in DATASETS and the built data folders) that are held back. */
export const HELD_BACK = [
  { id: 'opportunity-2018', name: 'The Opportunity Atlas (Opportunity Insights)', why: 'No license was checked; a person should confirm before it is shown.' },
  { id: 'eviction-2018', name: 'Eviction Lab (Princeton University)', why: 'No license text was found; a person should confirm before it is shown.' },
]

/**
 * National survey files on the Data sources page that are held back, by file name. build-site.ts never copies them to the
 * hosted site. On your own computer the American Time Use Survey still shows on the Survey data page, as a preview for
 * checking before it goes live.
 */
export const HELD_BACK_NATIONAL = [
  { file: 'ncvs-2024.json', name: 'National Crime Victimization Survey (BJS)', why: 'No terms stated; to be confirmed by the library.' },
  { file: 'yrbs-2025.json', name: 'Youth Risk Behavior Survey (CDC)', why: 'No licensing text; to be confirmed by the library.' },
  { file: 'brfss-2025.json', name: 'Behavioral Risk Factor Surveillance System (CDC)', why: 'No data-use terms stated; to be confirmed by the library.' },
  { file: 'nsduh-2024.json', name: 'National Survey on Drug Use and Health (SAMHSA)', why: 'No data-use terms stated; to be confirmed by the library.' },
  { file: 'atus-2025.json', name: 'American Time Use Survey (BLS)', why: 'No terms stated; to be confirmed by the library.' },
]

const HELD = new Set(HELD_BACK.map((d) => d.id))

/** True when a dataset id may be shown. */
export function isCleared(dataset) {
  return !HELD.has(dataset) && (!SITE || SITE.datasets.includes(dataset))
}

/** Removes held-back measures from a list, in place, and returns the list. */
export function dropHeldBack(measures) {
  for (let i = measures.length - 1; i >= 0; i--) if (!isCleared(measures[i].dataset)) measures.splice(i, 1)
  return measures
}

/** The national survey files that may be shown. */
export function clearedNationalFiles(files) {
  const held = new Set(HELD_BACK_NATIONAL.map((d) => d.file))
  return files.filter((f) => !held.has(f) && (!SITE || SITE.national.includes(f)))
}
