// An offline checker for NIBRS flat files: it reads a file the way an agency's records system writes it for its state program,
// tests it against rules from the FBI's published "2025.0 NIBRS Technical Specification" (16 June 2025), and says what is wrong,
// where, and how to fix it, in plain English. It changes nothing, sends nothing, and never submits anything to anyone.
//
// Layouts (positions) are the specification's section 6; the numbered errors are its section 5.2. A finding carries the FBI's error
// number only where we read that number and its message in the specification; checks of our own, or whose number we could not
// read cleanly, have specCode null, and the reader is told so. This is a first subset, not the whole error list: see COVERAGE.

export const SPEC_VERSION = '2025.0 NIBRS Technical Specification, FBI CJIS Division, 16 June 2025'

export const COVERAGE =
  'This checker tests the layout of each segment, the header, the incident number and dates, the exceptional-clearance rules, the ' +
  'main code lists for offenses, victims, offenders and arrestees, duplicate segments, victim-type and offense rules, and arrest ' +
  'dates against incident dates. It does not yet test every error in the FBI list (for example the weapon, property and drug ' +
  'rules, and the age-and-relationship rules), and a file that passes here can still be rejected by your state program, which ' +
  'may add its own rules. Use it to find problems early, not as proof a file is accepted.'

const GROUP_A_OFFENSES = new Set(
  ('09A 09B 09C 100 11A 11B 11C 11D 120 13A 13B 13C 200 210 220 23A 23B 23C 23D 23E 23F 23G 23H 240 250 26A 26B 26C 26D 26E 26F 26G 26H ' +
    '270 280 290 30A 30B 30C 30D 35A 35B 36A 36B 360 370 39A 39B 39C 39D 40A 40B 40C 49A 49B 49C 510 520 521 522 526 64A 64B 101 103').split(' '),
)
const GROUP_B_OFFENSES = new Set('90A 90B 90C 90D 90E 90F 90G 90H 90I 90J 90K 90L 90M 90N 90O 90P 90Q 90R 90Z'.split(' '))
// Offenses a victim can be connected to (data element 24).
const VICTIM_OFFENSES = new Set('09A 09B 09C 100 11A 11B 11C 11D 120 13A 13B 13C 200 210 220 23A 23B 23C 23D 23E 23F 23G 23H 240 250 26A 26B 26C 26D 26E 26F 26G 26H 270 280 290 30A 30B 30C 30D 35A 35B 36A 36B 360 370 39A 39B 39C 39D 40A 40B 40C 49A 49B 49C 510 520 521 522 526 64A 64B 101 103'.split(' '))
// Crimes against society (the victim is society/public): drug, gambling, pornography, prostitution, weapon law and similar.
const SOCIETY_OFFENSES = new Set('35A 35B 370 39A 39B 39C 39D 40A 40B 40C 520 521 522 526'.split(' '))
const LOCATIONS =new Set('01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 16 17 18 19 20 21 23 24 25 37 38 39 40 41 42 44 45 46 47 48 49 50 51 52 53 54 55 56 57 58'.split(' '))
const VICTIM_TYPES = new Set('B F G I L O R S U'.split(' '))
const SEX = new Set(['F', 'M', 'U'])
const RACES = new Set('W B I A P U'.split(' '))
const ETHNICITIES = new Set(['H', 'N', 'U'])
const RESIDENT = new Set(['N', 'R', 'U'])
const ARREST_TYPES = new Set(['O', 'S', 'T'])
const CLEARED = new Set('A B C D E N'.split(' '))
const PROPERTY_LOSS = new Set('1 2 3 4 5 6 7 8'.split(' '))

/** Segment levels: length of the line including its 4-character length field, name, and which levels are Group A. */
const LEVELS = {
  1: { name: 'Administrative', lengths: [87, 88], actions: ['I', 'D'] },
  2: { name: 'Offense', lengths: [63, 71], actions: ['I'] },
  3: { name: 'Property', lengths: [307], actions: ['I'] },
  4: { name: 'Victim', lengths: [129, 141], actions: ['I'] },
  5: { name: 'Offender', lengths: [45, 46], actions: ['I'] },
  6: { name: 'Arrestee', lengths: [110], actions: ['I'] },
  7: { name: 'Group B arrest', lengths: [66], actions: ['A', 'M', 'D'] },
  0: { name: 'Zero report', lengths: [43], actions: ['A'] },
}

const pos = (line, a, b = a) => line.slice(a - 1, b)
const blank = (s) => s.trim() === ''

/** @returns {{y:number,m:number,d:number}|null} a real calendar date from YYYYMMDD, else null */
export function parseDate(s) {
  if (!/^\d{8}$/.test(s)) return null
  const y = +s.slice(0, 4)
  const m = +s.slice(4, 6)
  const d = +s.slice(6, 8)
  if (y < 1900 || y > 2099 || m < 1 || m > 12 || d < 1) return null
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return d <= days ? { y, m, d } : null
}
const dateNum = (p) => p.y * 10000 + p.m * 100 + p.d

/**
 * @typedef {object} Finding
 * @property {number} line 1-based line in the file
 * @property {string} segment segment level name
 * @property {string} incident incident number, if the line has one
 * @property {string | null} specCode the FBI error number when we read it in the specification, else null
 * @property {string} element what the problem is in (a data element name)
 * @property {string} value the text found there
 * @property {string} message what is wrong, in plain English
 * @property {string} fix what to do about it
 */

/**
 * Check a flat file.
 * @param {string} text the whole file
 * @param {{ today?: Date }} [options]
 * @returns {{ findings: Finding[], segments: number, incidents: number, groupB: number, zero: number, specVersion: string, coverage: string }}
 */
export function checkFlatFile(text, options = {}) {
  const today = options.today ?? new Date()
  const todayNum = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
  /** @type {Finding[]} */
  const findings = []
  const lines = text.split(/\r?\n/)
  const numberChecked = new Set() // each incident number is checked once, on its first segment
  const incidents = new Map() // "ORI|number" -> { admin, offenses:Set, offenseLines, victims, offenders, line }
  let segments = 0
  let groupB = 0
  let zero = 0

  const add = (ln, level, incident, specCode, element, value, message, fix) =>
    findings.push({ line: ln, segment: LEVELS[level]?.name ?? 'Unknown', incident, specCode, element, value: value.trim() === '' ? '(blank)' : value.trim(), message, fix })

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (blank(line)) continue
    const ln = i + 1
    segments++
    const lenField = pos(line, 1, 4)
    const level = pos(line, 5)
    const lv = LEVELS[level]
    const incident = pos(line, 26, 37).trimEnd()
    if (!lv) {
      add(ln, level, incident, null, 'Segment level (position 5)', level, 'The segment level is not one of 0 to 7, so the line cannot be read.', 'Check the line starts with a four-digit length and a segment level 0-7. Lines may be shifted by extra characters at the start.')
      continue
    }
    // Length: the four-digit length field must match the real line, and be one the specification allows for this segment.
    const actual = line.length
    if (!/^\d{4}$/.test(lenField)) add(ln, level, incident, null, 'Segment length (positions 1-4)', lenField, 'The first four characters must be the segment length as four digits.', `Write ${String(actual).padStart(4, '0')} here if the rest of the line is correct.`)
    else if (+lenField !== actual) add(ln, level, incident, level === '1' ? '178' : null, 'Segment length (positions 1-4)', lenField, `The length field says ${+lenField} but the line is ${actual} characters long.`, 'Make the length field match the line, or find the missing or extra characters. Fields are fixed width and every field must be padded with blanks (letters and text) or zeros (numbers).')
    else if (!lv.lengths.includes(actual)) add(ln, level, incident, level === '1' ? '178' : null, 'Segment length (positions 1-4)', lenField, `A ${lv.name} segment must be ${lv.lengths.join(' or ')} characters; this one is ${actual}.`, 'Check the segment against the layout in section 6 of the specification; a field is probably missing or too wide.')
    const action = pos(line, 6)
    if (!lv.actions.includes(action)) add(ln, level, incident, null, 'Segment action type (position 6)', action, `A ${lv.name} segment takes the action type ${lv.actions.join(' or ')}.`, 'Use the action type the specification gives for this segment (section 4.6).')
    // Header: month and year of submission.
    const subMonth = pos(line, 7, 8)
    const subYear = pos(line, 9, 12)
    const subOk = /^(0[1-9]|1[0-2])$/.test(subMonth) && /^(19|20)\d\d$/.test(subYear)
    if (!subOk) add(ln, level, incident, null, 'Month and year of submission (positions 7-12)', subMonth + subYear, 'The submission month (01-12) and year (four digits) are not valid.', 'Write the month and year the file is for, for example 032025.')
    const ori = pos(line, 17, 25)
    {
      if (blank(ori)) add(ln, level, incident, null, 'ORI (positions 17-25)', ori, 'The agency identifier (ORI) is missing.', 'Enter the nine-character ORI your state assigns the agency.')
      else if (!/^[A-Z]{2}[A-Z0-9]{7}$/.test(ori)) add(ln, level, incident, null, 'ORI (positions 17-25)', ori, 'An ORI is nine characters: two letters for the state, then seven letters or digits.', 'Check the ORI against the one your state program gave you; do not leave spaces inside it.')
    }

    if (level === '0') {
      zero++
      continue
    }
    if (level === '7') {
      groupB++
      checkGroupB(line, ln, add, todayNum)
      continue
    }

    // Group A: incident number rules apply to every segment, but a bad number is reported once, on the incident's first segment.
    const incRaw = pos(line, 26, 37)
    const numKey = `${ori}|${incRaw}`
    if (!numberChecked.has(numKey)) {
      numberChecked.add(numKey)
      checkIncidentNumber(incRaw, ln, level, add)
    }
    const key = `${ori}|${incRaw.trimEnd()}`
    let inc = incidents.get(key)
    if (!inc) {
      inc = { admin: 0, offenses: new Set(), offenseLines: [], victims: 0, offenders: 0, line: ln, number: incRaw.trimEnd(), deleted: false, date: null, victimSeqs: new Set(), offenderSeqs: new Set(), arrests: [], offenseCount: 0 }
      incidents.set(key, inc)
    }
    if (level === '1') {
      inc.admin++
      if (action === 'D') inc.deleted = true
      if (inc.admin === 2 && action === 'I') add(ln, level, incRaw.trimEnd(), null, 'Incident number (positions 26-37)', incRaw, 'This incident number appears in more than one administrative segment in the file.', 'Each incident gets one administrative segment. If this is a different incident, give it its own number; if it is a repeat, remove it.')
      if (action === 'I') {
        checkAdmin(line, ln, incRaw.trimEnd(), add, todayNum, subYear + subMonth)
        const d = parseDate(pos(line, 38, 45))
        if (d && !inc.date) inc.date = dateNum(d)
      }
    } else if (level === '2') {
      const code = pos(line, 38, 40)
      if (inc.offenses.has(code)) add(ln, level, incRaw.trimEnd(), '262', 'UCR offense code (positions 38-40)', code, 'DUPLICATE OFFENSE SEGMENT: two offense segments in this incident have the same offense code.', 'Each offense code appears once in an incident. Remove the repeat; the number of victims and offenders is carried by the victim and offender segments.')
      inc.offenses.add(code)
      inc.offenseLines.push(ln)
      if (++inc.offenseCount === 11) add(ln, level, incRaw.trimEnd(), '263', 'Offense segments', String(inc.offenseCount), 'CANNOT HAVE MORE THAN 10 GROUP A OFFENSE SEGMENTS in one incident.', 'Keep the ten most serious offenses in this incident, as the specification directs (section 4).')
      checkOffense(line, ln, incRaw.trimEnd(), add)
    } else if (level === '3') checkProperty(line, ln, incRaw.trimEnd(), add)
    else if (level === '4') {
      inc.victims++
      const vseq = pos(line, 38, 40)
      if (/^\d{3}$/.test(vseq) && inc.victimSeqs.has(vseq)) add(ln, level, incRaw.trimEnd(), '451', 'Victim sequence number (positions 38-40)', vseq, 'VICTIM NUMBER ALREADY EXISTS: two victim segments in this incident have the same sequence number.', 'Give each victim its own sequence number (001, 002, ...) within the incident.')
      inc.victimSeqs.add(vseq)
      checkVictim(line, ln, incRaw.trimEnd(), add, inc)
    } else if (level === '5') {
      inc.offenders++
      const oseq = pos(line, 38, 39)
      if (/^\d\d$/.test(oseq)) {
        if (inc.offenderSeqs.has(oseq)) add(ln, level, incRaw.trimEnd(), '551', 'Offender sequence number (positions 38-39)', oseq, 'DUPLICATE OFFENDER SEGMENT: two offender segments in this incident have the same sequence number.', 'Give each offender its own sequence number (01, 02, ...), or remove the repeat.')
        inc.offenderSeqs.add(oseq)
      }
      checkOffender(line, ln, incRaw.trimEnd(), add)
    } else if (level === '6') {
      const d = parseDate(pos(line, 52, 59))
      if (d) inc.arrests.push({ ln, date: dateNum(d), raw: pos(line, 52, 59) })
      checkArrestee(line, ln, incRaw.trimEnd(), add, todayNum)
    }
  }

  // Whole-incident rules: every Group A incident needs an administrative, an offense, a victim and an offender segment.
  for (const inc of incidents.values()) {
    if (inc.deleted) continue
    const number = inc.number
    if (inc.admin === 0) add(inc.line, '1', number, null, 'Administrative segment', '(none)', 'This incident has offense, victim or other segments but no administrative segment.', 'Add the administrative segment (level 1) for this incident number.')
    if (inc.offenses.size === 0) add(inc.line, '2', number, null, 'Offense segment', '(none)', 'An incident needs at least one offense segment.', 'Add the offense segment, or remove the incident if no offense was recorded.')
    if (inc.victims === 0) add(inc.line, '4', number, null, 'Victim segment', '(none)', 'An incident needs at least one victim segment (the victim may be a business, society or unknown).', 'Add a victim segment for each victim.')
    if (inc.offenders === 0) add(inc.line, '5', number, null, 'Offender segment', '(none)', 'An incident needs at least one offender segment; when nothing is known about the offender, one segment with sequence 00 and unknown values is used.', 'Add an offender segment with sequence number 00 and unknown age, sex and race.')
    if (inc.offenderSeqs.has('00') && inc.offenderSeqs.size > 1) add(inc.line, '5', number, '555', 'Offender sequence number (positions 38-39)', '00', 'OFFENDER 00 EXISTS: no more offenders can be submitted when an offender with sequence 00 (unknown) is present.', 'Either remove the 00 offender because the others are known, or remove the others.')
    if (inc.offenses.has('09C') && inc.offenses.size > 1) add(inc.offenseLines[0], '2', number, '266', 'UCR offense code (positions 38-40)', '09C', 'NO OTHER OFFENSE CAN BE SUBMITTED WITH JUSTIFIABLE HOMICIDE (09C).', 'A justifiable homicide is reported as the only offense in its incident; report any other offense in a separate incident.')
    for (const a of inc.arrests) if (inc.date && a.date < inc.date) add(a.ln, '6', number, '665', 'Arrest date (positions 52-59)', a.raw, 'ARREST DATE CANNOT BE BEFORE THE INCIDENT START DATE: a person cannot be arrested before the incident happened.', 'Check the arrest date and the incident date; one of them is mistyped.')
  }

  findings.sort((a, b) => a.line - b.line)
  return { findings, segments, incidents: incidents.size, groupB, zero, specVersion: SPEC_VERSION, coverage: COVERAGE }
}

function checkIncidentNumber(raw, ln, level, add) {
  const t = raw.trimEnd()
  if (blank(raw)) return add(ln, level, '', '101', 'Incident number (positions 26-37)', raw, 'MUST BE PRESENT: the incident number is missing.', 'Enter the incident number your records system assigned (up to 12 characters).')
  if (raw[0] === ' ') add(ln, level, t, '116', 'Incident number (positions 26-37)', raw, 'MUST BE LEFT JUSTIFIED: the number starts with a blank.', 'Move the number to the first position and pad with blanks on the right.')
  else if (/\s/.test(t)) add(ln, level, t, '115', 'Incident number (positions 26-37)', raw, 'CANNOT HAVE EMBEDDED BLANKS between its first and last characters.', 'Remove the spaces inside the number, or replace them with a hyphen.')
  if (!/^[A-Z0-9\- ]*$/.test(t)) add(ln, level, t, '117', 'Incident number (positions 26-37)', raw, 'CANNOT HAVE CHARACTERS OTHER THAN A-Z (capitals), 0-9, hyphen or blanks.', 'Remove lowercase letters and symbols such as + / * . from the number.')
}

function checkAdmin(line, ln, number, add, todayNum, submission) {
  const incStr = pos(line, 38, 45)
  const indicator = pos(line, 46)
  const hour = pos(line, 47, 48)
  const cleared = pos(line, 49)
  const exDate = pos(line, 50, 57)
  const el = 'Incident date (positions 38-45)'
  const incDate = parseDate(incStr)
  if (blank(incStr)) add(ln, '1', number, '101', el, incStr, 'MUST BE PRESENT: the incident date is missing.', 'Enter the date the incident happened as YYYYMMDD. If it is unknown, enter the date it was reported and put R in position 46.')
  else if (!incDate) add(ln, '1', number, '105', el, incStr, 'INVALID DATA VALUE FOR DATE: it must be a real date written YYYYMMDD (month 01-12, day within the month, four-digit year).', 'Correct the date; a day that does not exist (such as 0230 or 0631) or a two-digit year is the usual cause.')
  else {
    if (dateNum(incDate) > todayNum) add(ln, '1', number, '105', el, incStr, 'INVALID DATA VALUE FOR DATE: the date is in the future.', 'Check the year and month; the incident date cannot be after today.')
    if (dateNum(incDate) < 19910101) add(ln, '1', number, '172', el, incStr, 'INCIDENT DATE/HOUR FOR I RECORDS CANNOT PREDATE 01/01/1991.', 'The FBI began accepting NIBRS data on that date, so an earlier date is almost certainly a typing error.')
    if (/^(0[1-9]|1[0-2])$/.test(submission.slice(4)) && /^\d{4}$/.test(submission.slice(0, 4)) && incDate.y * 100 + incDate.m > +submission.slice(0, 4) * 100 + +submission.slice(4)) add(ln, '1', number, '170', el, incStr, 'INCIDENT DATE CANNOT BE AFTER MONTH AND YEAR OF ELECTRONIC SUBMISSION.', 'Either the date is wrong or the file was labelled with an earlier month and year than it holds (positions 7-12).')
  }
  if (!(indicator === ' ' || indicator === 'R')) add(ln, '1', number, '151', 'Report date indicator (position 46)', indicator, 'REPORT INDICATOR MUST BE BLANK OR R.', 'Leave position 46 blank when the incident date is known; use R only when the date given is the report date.')
  if (!blank(hour) && !(/^\d\d$/.test(hour) && +hour <= 23)) add(ln, '1', number, '152', 'Incident hour (positions 47-48)', hour, 'INVALID HOUR ENTRY: the hour must be 00 through 23 or left blank.', 'Use a 24-hour value. Exactly midnight is entered as the following day at 00.')
  if (blank(cleared)) add(ln, '1', number, '101', 'Cleared exceptionally (position 49)', cleared, 'MUST BE PRESENT: say whether the case was cleared exceptionally.', 'Enter N when it was not, or A-E for the reason it was.')
  else if (!CLEARED.has(cleared)) add(ln, '1', number, '104', 'Cleared exceptionally (position 49)', cleared, 'INVALID DATA VALUE: it must be A, B, C, D, E or N.', 'Use N (not applicable) unless the case was cleared exceptionally for one of the reasons A-E.')
  const exParsed = parseDate(exDate)
  if (CLEARED.has(cleared) && 'ABCDE'.includes(cleared)) {
    if (blank(exDate)) add(ln, '1', number, '156', 'Exceptional clearance date (positions 50-57)', exDate, 'AN ENTRY MUST BE MADE WHEN CLEARED EXCEPTIONALLY HAS ENTRIES OF A-E: the clearance date is missing.', 'Enter the date of the exceptional clearance as YYYYMMDD.')
  }
  if (cleared === 'N' && !blank(exDate)) add(ln, '1', number, '153', 'Exceptional clearance date (positions 50-57)', exDate, 'CANNOT HAVE N=NOT APPLICABLE IF the exceptional clearance date is entered.', 'Either set position 49 to A-E, or clear the date.')
  if (!blank(exDate)) {
    if (!exParsed) add(ln, '1', number, '105', 'Exceptional clearance date (positions 50-57)', exDate, 'INVALID DATA VALUE FOR DATE: it must be a real date written YYYYMMDD.', 'Correct the clearance date.')
    else if (incDate && dateNum(exParsed) < dateNum(incDate)) add(ln, '1', number, '155', 'Exceptional clearance date (positions 50-57)', exDate, 'CLEARANCE DATE PREDATES INCIDENT DATE.', 'A case cannot be cleared before it happened; check both dates.')
  }
}

function checkOffense(line, ln, number, add) {
  const code = pos(line, 38, 40)
  const completed = pos(line, 41)
  const location = pos(line, 45, 46)
  const premises = pos(line, 47, 48)
  const entry = pos(line, 49)
  if (blank(code)) add(ln, '2', number, '201', 'UCR offense code (positions 38-40)', code, 'MUST BE PRESENT: the offense code is missing.', 'Enter the NIBRS offense code, for example 13A for aggravated assault.')
  else if (!GROUP_A_OFFENSES.has(code)) add(ln, '2', number, '204', 'UCR offense code (positions 38-40)', code, 'INVALID DATA VALUE: not a Group A offense code on the FBI table.' + (GROUP_B_OFFENSES.has(code) ? ' This is a Group B code; Group B offenses are reported as arrests only.' : ''), 'Map your local offense to the closest NIBRS Group A offense code. Do not guess: a person should decide.')
  if (blank(completed)) add(ln, '2', number, '201', 'Attempted/completed (position 41)', completed, 'MUST BE PRESENT: say whether the offense was attempted (A) or completed (C).', 'Enter A or C.')
  else if (!'ACU'.includes(completed)) add(ln, '2', number, '204', 'Attempted/completed (position 41)', completed, 'INVALID DATA VALUE: it must be A (attempted) or C (completed).', 'Use A or C.')
  if (blank(location)) add(ln, '2', number, '201', 'Location type (positions 45-46)', location, 'MUST BE PRESENT: the location type is missing.', 'Enter the two-digit location code, for example 20 for residence/home; use 25 for other/unknown.')
  else if (!LOCATIONS.has(location)) add(ln, '2', number, '204', 'Location type (positions 45-46)', location, 'INVALID DATA VALUE: not on the FBI location table. Codes are two digits; there is no 22, 26-36 or 43.', 'Pick the nearest valid location, or 25 for other/unknown.')
  if (code === '220' && (location === '14' || location === '19')) {
    if (blank(premises)) add(ln, '2', number, '201', 'Number of premises entered (positions 47-48)', premises, 'MUST BE PRESENT: a burglary at a hotel/motel or rental storage facility needs the number of premises entered.', 'Enter how many rooms or units were entered, 01-99.')
    else if (!/^(0[1-9]|[1-9]\d)$/.test(premises)) add(ln, '2', number, '204', 'Number of premises entered (positions 47-48)', premises, 'It is not a number from 01 to 99.', 'Enter the count of rooms or units entered.')
  } else if (!blank(premises)) {
    if (!/^(0[1-9]|[1-9]\d)$/.test(premises)) add(ln, '2', number, '202', 'Number of premises entered (positions 47-48)', premises, 'CONTAINS NONNUMERIC ENTRY or a value outside 01-99.', 'Leave it blank, or enter a number from 01 to 99.')
    else add(ln, '2', number, '252', 'Number of premises entered (positions 47-48)', premises, 'OFFENSE CODE MUST BE 220 WITH A LOCATION TYPE OF 14 OR 19 FOR DATA TO BE ENTERED: the number of premises applies only to a burglary at a hotel/motel or rental storage facility.', 'Leave the number of premises blank for this offense and location.')
  }
  if (code === '220' && blank(entry)) add(ln, '2', number, '201', 'Method of entry (position 49)', entry, 'MUST BE PRESENT: a burglary needs the method of entry.', 'Enter F (force) or N (no force).')
  else if (!blank(entry) && !'FN'.includes(entry)) add(ln, '2', number, '204', 'Method of entry (position 49)', entry, 'INVALID DATA VALUE: it must be F or N.', 'Use F for forced entry or N for no force.')
  else if (!blank(entry) && code !== '220' && GROUP_A_OFFENSES.has(code)) add(ln, '2', number, '254', 'Method of entry (position 49)', entry, 'MUST BE BLANK WHEN OFFENSE IS OTHER THAN 220: method of entry applies only to burglary.', 'Leave method of entry blank for this offense.')
  if (completed === 'A' && ['09A', '09B', '09C', '13A', '13B', '13C', '360'].includes(code)) add(ln, '2', number, '256', 'Attempted/completed (position 41)', completed, 'MUST HAVE ENTRY OF C: homicide and assault offenses (and 360) are always reported as completed.', 'Use C. An attempted murder is reported as aggravated assault (13A), not as an attempted 09A.')
}

function checkProperty(line, ln, number, add) {
  const loss = pos(line, 38)
  if (blank(loss)) add(ln, '3', number, null, 'Type of property loss (position 38)', loss, 'The type of property loss is missing.', 'Enter 1-8; for example 7 for stolen, 5 for recovered, 1 for none.')
  else if (!PROPERTY_LOSS.has(loss)) add(ln, '3', number, null, 'Type of property loss (position 38)', loss, 'The type of property loss must be a digit 1 to 8.', 'Use 7 for stolen/etc. or 8 for unknown if unsure.')
}

function checkVictim(line, ln, number, add, inc) {
  const seq = pos(line, 38, 40)
  const connected = pos(line, 41, 43)
  const type = pos(line, 71)
  const age = pos(line, 72, 75)
  const sex = pos(line, 76)
  const race = pos(line, 77)
  const ethnicity = pos(line, 78)
  const resident = pos(line, 79)
  if (!/^\d{3}$/.test(seq) || +seq < 1) add(ln, '4', number, null, 'Victim sequence number (positions 38-40)', seq, 'The victim sequence number must be a three-digit number from 001 up.', 'Number victims 001, 002, and so on within the incident.')
  if (blank(connected)) add(ln, '4', number, '401', 'Victim connected to offense (positions 41-43)', connected, 'MUST BE PRESENT: every victim must be connected to at least one offense.', 'Enter the code of an offense in this incident the victim suffered.')
  else if (!VICTIM_OFFENSES.has(connected)) add(ln, '4', number, null, 'Victim connected to offense (positions 41-43)', connected, 'The code is not an offense a victim can be connected to.', 'Use one of the offense codes in this incident.')
  else if (inc.offenses.size > 0 && !inc.offenses.has(connected)) add(ln, '4', number, null, 'Victim connected to offense (positions 41-43)', connected, `The victim is connected to offense ${connected}, but the incident has no offense segment with that code.`, 'Either add that offense segment or connect the victim to an offense that is in the incident. (Offense segments must come before victim segments in the file.)')
  if (blank(type)) add(ln, '4', number, null, 'Type of victim (position 71)', type, 'The type of victim is missing.', 'Enter I (individual), B (business), S (society/public), and so on.')
  else if (!VICTIM_TYPES.has(type)) add(ln, '4', number, null, 'Type of victim (position 71)', type, 'The victim type must be one of B, F, G, I, L, O, R, S, U.', 'Use I for a person, B for a business, S for society/public, U if unknown.')
  if (VICTIM_OFFENSES.has(connected) && VICTIM_TYPES.has(type)) {
    if (SOCIETY_OFFENSES.has(connected) && type !== 'S') add(ln, '4', number, '465', 'Type of victim (position 71)', type, `ENTRY FOR TYPE OF VICTIM MUST BE S WHEN THIS OFFENSE CODE IS ENTERED: ${connected} is a crime against society, so the victim is society/public.`, 'Set the victim type to S.')
    else if (!SOCIETY_OFFENSES.has(connected) && type === 'S') add(ln, '4', number, '466', 'Type of victim (position 71)', type, `ENTRY FOR TYPE OF VICTIM CANNOT BE S WHEN THIS OFFENSE CODE IS ENTERED: ${connected} is not a crime against society.`, 'Use the victim type that fits (I for a person, B for a business, and so on).')
  }
  checkAge(age, ln, '4', number, add, 'Age of victim (positions 72-75)', type === 'I' || type === 'L')
  if (type === 'I' || type === 'L') {
    if (blank(sex)) add(ln, '4', number, null, 'Sex of victim (position 76)', sex, 'An individual victim needs a sex entry.', 'Enter F, M or U (unknown).')
    else if (!SEX.has(sex)) add(ln, '4', number, null, 'Sex of victim (position 76)', sex, 'It must be F, M or U.', 'Use U when unknown.')
    if (!blank(race) && !RACES.has(race)) add(ln, '4', number, null, 'Race of victim (position 77)', race, 'It must be W, B, I, A, P or U.', 'Use U when unknown.')
    if (!blank(ethnicity) && !ETHNICITIES.has(ethnicity)) add(ln, '4', number, null, 'Ethnicity of victim (position 78)', ethnicity, 'It must be H, N or U.', 'Use U when unknown.')
    if (!blank(resident) && !RESIDENT.has(resident)) add(ln, '4', number, null, 'Resident status of victim (position 79)', resident, 'It must be N, R or U.', 'Use U when unknown.')
  }
}

function checkAge(age, ln, level, number, add, element, required) {
  const t = age.trim()
  const ok = /^\d{2}$/.test(t) || /^\d{2}\d{2}$/.test(t) || ['NN', 'NB', 'BB'].includes(t) || /^\d\d\d\d$/.test(age) || /^\d\d {2}$/.test(age)
  if (blank(age)) {
    if (required) add(ln, level, number, null, element, age, 'An individual needs an age entry.', 'Enter the age in years (two digits), 00 if unknown, or NN, NB or BB for infants.')
    return
  }
  if (!ok) add(ln, level, number, null, element, age, 'The age is not a valid entry. Use two digits (00 for unknown, 99 for over 98), a range such as 2535, or NN, NB, BB for infants.', 'Correct the age; a decimal point or a text value is the usual cause.')
  else if (/^\d\d\d\d$/.test(age) && +age.slice(0, 2) > +age.slice(2)) add(ln, level, number, null, element, age, 'In an age range the first age must not be higher than the second.', 'Swap the two ages, or enter a single age.')
}

function checkOffender(line, ln, number, add) {
  const seq = pos(line, 38, 39)
  const age = pos(line, 40, 43)
  const sex = pos(line, 44)
  const race = pos(line, 45)
  if (!/^\d\d$/.test(seq)) add(ln, '5', number, null, 'Offender sequence number (positions 38-39)', seq, 'The offender sequence number must be two digits; 00 means nothing is known about the offender.', 'Number offenders 01, 02, ...; use 00 for an unknown offender.')
  if (seq === '00') {
    if (!blank(sex) && sex !== 'U') add(ln, '5', number, null, 'Sex of offender (position 44)', sex, 'An unknown offender (sequence 00) should have sex U or blank.', 'Set the offender sex to U, or give the offender a real sequence number.')
    return
  }
  checkAge(age, ln, '5', number, add, 'Age of offender (positions 40-43)', false)
  if (!blank(sex) && !SEX.has(sex)) add(ln, '5', number, null, 'Sex of offender (position 44)', sex, 'It must be F, M or U.', 'Use U when unknown.')
  if (!blank(race) && !RACES.has(race)) add(ln, '5', number, null, 'Race of offender (position 45)', race, 'It must be W, B, I, A, P or U.', 'Use U when unknown.')
}

function checkArrestee(line, ln, number, add, todayNum) {
  const seq = pos(line, 38, 39)
  const date = pos(line, 52, 59)
  const type = pos(line, 60)
  const offense = pos(line, 62, 64)
  const age = pos(line, 71, 74)
  const sex = pos(line, 75)
  const race = pos(line, 76)
  if (!/^\d\d$/.test(seq) || +seq < 1) add(ln, '6', number, null, 'Arrestee sequence number (positions 38-39)', seq, 'The arrestee sequence number must be two digits from 01 up.', 'Number arrestees 01, 02, ...')
  const p = parseDate(date)
  if (!p) add(ln, '6', number, '105', 'Arrest date (positions 52-59)', date, 'INVALID DATA VALUE FOR DATE: the arrest date must be a real date written YYYYMMDD.', 'Correct the arrest date.')
  else if (dateNum(p) > todayNum) add(ln, '6', number, '105', 'Arrest date (positions 52-59)', date, 'INVALID DATA VALUE FOR DATE: the arrest date is in the future.', 'Check the year and month.')
  if (!ARREST_TYPES.has(type)) add(ln, '6', number, null, 'Type of arrest (position 60)', type, 'It must be O (on-view), S (summoned/cited) or T (taken into custody).', 'Choose the one that matches how the arrest happened.')
  if (!GROUP_A_OFFENSES.has(offense) && !GROUP_B_OFFENSES.has(offense)) add(ln, '6', number, null, 'Arrest offense code (positions 62-64)', offense, 'It is not a NIBRS offense code.', 'Use the code of the offense the person was arrested for.')
  checkAge(age, ln, '6', number, add, 'Age of arrestee (positions 71-74)', true)
  if (!SEX.has(sex)) add(ln, '6', number, null, 'Sex of arrestee (position 75)', sex, 'It must be F, M or U.', 'Use U when unknown.')
  if (!RACES.has(race)) add(ln, '6', number, null, 'Race of arrestee (position 76)', race, 'It must be W, B, I, A, P or U.', 'Use U when unknown.')
}

function checkGroupB(line, ln, add, todayNum) {
  const date = pos(line, 40, 47)
  const type = pos(line, 48)
  const offense = pos(line, 49, 51)
  const p = parseDate(date)
  if (!p) add(ln, '7', '', '105', 'Arrest date (positions 40-47)', date, 'INVALID DATA VALUE FOR DATE: the arrest date must be a real date written YYYYMMDD.', 'Correct the arrest date.')
  else if (dateNum(p) > todayNum) add(ln, '7', '', '105', 'Arrest date (positions 40-47)', date, 'INVALID DATA VALUE FOR DATE: the arrest date is in the future.', 'Check the year and month.')
  if (!ARREST_TYPES.has(type)) add(ln, '7', '', null, 'Type of arrest (position 48)', type, 'It must be O, S or T.', 'Choose the one that matches how the arrest happened.')
  if (!GROUP_B_OFFENSES.has(offense) && !GROUP_A_OFFENSES.has(offense)) add(ln, '7', '', null, 'Arrest offense code (positions 49-51)', offense, 'It is not a NIBRS offense code.', 'Use a Group B code such as 90C (disorderly conduct) or 90Z (all other offenses).')
}

/** A short plain-English summary of a check: counts by kind of problem. */
export function summarize(result) {
  const byElement = new Map()
  for (const f of result.findings) byElement.set(f.element, (byElement.get(f.element) ?? 0) + 1)
  return [...byElement.entries()].sort((a, b) => b[1] - a[1]).map(([element, count]) => ({ element, count }))
}

/** The findings as CSV, so an agency can sort and share them. */
export function findingsCsv(result) {
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`
  const head = ['line', 'segment', 'incident', 'fbi_error', 'element', 'value', 'problem', 'how_to_fix']
  const rows = result.findings.map((f) => [f.line, f.segment, f.incident, f.specCode ?? '', f.element, f.value, f.message, f.fix].map(q).join(','))
  return [head.join(','), ...rows].join('\r\n') + '\r\n'
}
