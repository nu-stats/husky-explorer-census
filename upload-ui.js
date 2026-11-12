// "Your own data": the user picks a CSV, the match assistant works out what its rows are (counties, tracts, towns,
// ZIP code areas…), and its numeric columns become measures on the map. The file is read here in the browser and never
// sent anywhere. The assistant says what it found and why, offers other readings, and explains every row that did not match.
import { esc } from './lib/chart.js'
import { openText } from './open-file.js'
import { loadIndex, loadTable } from './lib/data.js'
import { parseCsv, uploadTable } from './lib/join.js'
import { aggregate, aggregatedTables, aggregateRecipe, guessKind, KINDS, upLevels } from './lib/aggregate.js'
import { applyReading, explain, LEVEL_GUIDE, levelWord, numericColumns, readings, recipe, unmatchedCsv } from './lib/match.js'

// The levels whose areas and names the assistant checks the file against, for the state chosen on the map.
const CHECKED = ['county', 'cousub', 'place', 'tract', 'zcta']

async function areaList(level, state, built) {
  if (!state || !built[state]?.levels.includes(level)) return undefined
  try {
    const t = await loadTable('acs5-2024', 'B01003', level, state)
    const names = new Map(Object.keys(t.file.rows).map((g) => [g, t.name(g)]))
    return { ids: new Set(names.keys()), names }
  } catch {
    return undefined
  }
}

// The 2010 tracts, to tell a file from the old boundaries from one with typos.
async function oldTracts(state, built) {
  if (!state || !built[state]?.datasets.includes('dec-2010')) return undefined
  try {
    return new Set(Object.keys((await loadTable('dec-2010', 'P1', 'tract', state)).file.rows))
  } catch {
    return undefined
  }
}

/**
 * @param {{ el: (id: string) => HTMLElement,
 *   knownIds: (level: string) => Promise<Set<string>>,
 *   state: () => string,
 *   apply: (loaded: { measures: object[], tables: Map<string, object>, level: string } | null) => void }} hooks
 */
export function setupUpload({ el, knownIds, state, apply }) {
  let file = null // { name, headers, body }
  let chosen = null // the reading's id the person picked, kept across a change of state
  let download = null // unmatched rows as CSV text

  const p = (text, cls = 'note') => Object.assign(document.createElement('p'), { textContent: text, className: cls })

  // The reference card: what each level is, how big, what its ID looks like.
  el('level-guide').innerHTML =
    '<table class="census"><thead><tr><th scope="col">Level</th><th scope="col">ID</th><th scope="col">Example</th><th scope="col">How many</th></tr></thead><tbody>' +
    LEVEL_GUIDE.map((l) => `<tr><th scope="row">${esc(l.name)}</th><td>${esc(l.ids)}</td><td>${esc(l.example)}</td><td>${esc(l.size)}</td></tr><tr><td colspan="4" class="note">${esc(l.note)}</td></tr>`).join('') +
    '</tbody></table>'

  async function context() {
    const built = await loadIndex()
    const st = state()
    const lists = {}
    for (const level of CHECKED) lists[level] = await areaList(level, st, built)
    return { state: st, lists, old: { tract: await oldTracts(st, built) } }
  }

  async function process() {
    const detect = el('upload-detect')
    const report = el('upload-report')
    download = null
    el('upload-download').hidden = true
    el('aggregate').hidden = true
    if (!file) {
      detect.replaceChildren()
      report.replaceChildren()
      el('upload-recipe').hidden = true
      apply(null)
      return
    }
    const ctx = await context()
    const all = readings(file.headers, file.body, ctx)
    if (!all.length) {
      apply(null)
      el('upload-recipe').hidden = true
      detect.replaceChildren(p('I could not tell what the rows are. A column of IDs (county 5 digits, tract 11), IDs in parts (state, county, tract), ZIP codes, or county or town names would work. The level card below shows what each looks like. If you have names, choose a state on the map first: the same name exists in many states.', 'note'))
      el('level-guide-box').open = true
      report.replaceChildren()
      return
    }
    const reading = all.find((r) => r.id === chosen) ?? all[0]
    const applied = applyReading(file.body, reading)

    // What was found, and the other readings.
    const select = Object.assign(document.createElement('select'), { id: 'upload-reading', ariaLabel: 'How to read the file' })
    for (const r of all.slice(0, 8)) select.append(new Option(`${r.say.split('.')[0]}.`, r.id, false, r.id === reading.id))
    select.addEventListener('change', () => {
      chosen = select.value
      process()
    })
    detect.replaceChildren(
      p(reading.say, 'note'),
      ...(all.length > 1 ? [Object.assign(document.createElement('label'), { textContent: 'Read it another way: ' })] : []),
    )
    if (all.length > 1) detect.lastChild.append(select)
    if (!reading.sure && ctx.lists[reading.level]) detect.append(p('Fewer than 4 in 5 rows matched this way: check that this is the right reading.', 'note'))
    if (!ctx.lists[reading.level] && reading.kind !== 'geoid') detect.append(p('Choose a state that has been fetched, so names and codes can be checked.', 'note'))

    // The measures: the numeric columns, at the level the rows are.
    const up = { rows: applied.rows }
    const columns = numericColumns(file.headers, file.body, reading.columns)
    if (!columns.length) {
      apply(null)
      report.replaceChildren(p('No column of numbers was found besides the ones that identify the rows.'))
      return
    }
    const tables = new Map()
    const measures = columns.map((c) => {
      const id = `upload:${c}`
      tables.set(id, uploadTable(up, c, id))
      return {
        id,
        label: file.headers[c] || `Column ${c + 1}`,
        dataset: 'upload',
        table: id,
        est: [id],
        unit: 'number',
        ramp: 'Blues',
        upload: true,
        group: 'Your file',
        levels: [reading.level],
        note: `From your file ${file.name}. It stays in your browser. Only ${levelWord(reading.level)} are drawn.`,
      }
    })
    await apply({ measures, tables, level: reading.level })

    // The report, with a reason for each row that did not match.
    const known = await knownIds(reading.level)
    const result = explain(file.body, applied.rowOf, reading, ctx.lists[reading.level] ? ctx : { ...ctx, lists: { ...ctx.lists, [reading.level]: { ids: known, names: new Map() } } })
    const onMap = [...applied.rows.keys()].filter((g) => known.has(g)).length
    const lines = [`${file.name}: ${file.body.length} rows; ${onMap} matched ${levelWord(reading.level)} on the map.`]
    if (known.size - onMap > 0) lines.push(`${known.size - onMap} areas on the map have no value in your file and are gray.`)
    report.replaceChildren(...lines.map((t) => p(t)))
    if (result.reasons.length) {
      const ul = document.createElement('ul')
      ul.className = 'plain'
      for (const r of result.reasons) {
        const li = document.createElement('li')
        li.className = 'note'
        li.textContent = `${r.count} ${r.text}${r.examples.length ? ` (for example ${r.examples.join(', ')})` : ''}.`
        ul.append(li)
      }
      report.append(ul)
      download = unmatchedCsv(result.unmatchedRows)
      el('upload-download').hidden = false
      el('upload-checklist').open = true
    }

    // The steps taken, for a methods note.
    const steps = recipe(reading, applied, result, file.name)
    el('upload-recipe-text').textContent = steps.join('\n')
    el('upload-recipe').hidden = false
    base = { reading, applied, columns, ctx, steps }
    offerAggregation()
  }

  // --- The aggregation assistant: the same rows at a larger level ---------------------------------------------------
  let base = null // what the file was read as, kept for aggregating

  function offerAggregation() {
    const box = el('aggregate')
    const ups = upLevels(base.reading.level).filter((l) => l !== 'state')
    box.hidden = false
    el('aggregate-result').replaceChildren()
    const say = el('aggregate-say')
    if (!ups.length) {
      say.textContent = `${levelWord(base.reading.level)[0].toUpperCase()}${levelWord(base.reading.level).slice(1)} do not sit inside a larger area by code, so adding them up needs the shapes (area weighting). That is planned; for now, the map shows them as they are. If these are census measures, switch the map to the larger level: the Bureau publishes them there directly.`
      el('aggregate-controls').hidden = true
      return
    }
    el('aggregate-controls').hidden = false
    say.textContent = `Your rows are ${levelWord(base.reading.level)}. To show a larger area I add them up, and what that means depends on the kind of number: a count is added, a rate or average needs a base to weight by, and a median cannot be built from smaller ones. Tell me what each column is. For census measures there is nothing to add up: the map already shows them at every level, as the Bureau published them.`
    const levelSel = el('aggregate-level')
    levelSel.replaceChildren(...ups.map((l) => new Option(levelWord(l), l)))
    const table = document.createElement('table')
    table.className = 'census'
    table.innerHTML = '<thead><tr><th scope="col">Column</th><th scope="col">What kind of number is it?</th><th scope="col">Weight it by</th></tr></thead>'
    const tbody = document.createElement('tbody')
    for (const c of base.columns) {
      const tr = document.createElement('tr')
      const name = Object.assign(document.createElement('th'), { scope: 'row', textContent: file.headers[c] || `Column ${c + 1}` })
      const kind = Object.assign(document.createElement('select'), { ariaLabel: `Kind of number: ${file.headers[c]}` })
      const guess = guessKind(file.headers[c] ?? '', file.body.map((r) => r[c]))
      for (const [k, v] of Object.entries(KINDS)) kind.append(new Option(v.name, k, false, k === guess))
      kind.dataset.col = String(c)
      const weight = Object.assign(document.createElement('select'), { ariaLabel: `Weight for ${file.headers[c]}` })
      weight.append(new Option('census population (ACS 2020–24)', 'census'))
      for (const w of base.columns) if (w !== c) weight.append(new Option(`the column “${file.headers[w]}”`, `col:${w}`))
      weight.dataset.col = String(c)
      const showWeight = () => (weight.hidden = !['rate', 'mean'].includes(kind.value))
      kind.addEventListener('change', showWeight)
      showWeight()
      const k = document.createElement('td')
      k.append(kind)
      const w = document.createElement('td')
      w.append(weight)
      tr.append(name, k, w)
      tbody.append(tr)
    }
    table.append(tbody)
    el('aggregate-columns').replaceChildren(table)
  }

  async function makeAggregate() {
    if (!base) return
    const to = el('aggregate-level').value
    const from = base.reading.level
    const specs = base.columns.map((c) => {
      const kind = el('aggregate-columns').querySelector(`select[aria-label^="Kind"][data-col="${c}"]`).value
      const w = el('aggregate-columns').querySelector(`select[aria-label^="Weight"][data-col="${c}"]`).value
      return { col: c, kind, ...(['rate', 'mean'].includes(kind) ? { weight: w === 'census' ? { census: true } : { column: Number(w.slice(4)) } } : {}) }
    })
    const st = state()
    // The census population by area, when something is weighted by it.
    let census = null
    if (specs.some((s) => s.weight && 'census' in s.weight)) {
      try {
        const t = await loadTable('acs5-2024', 'B01003', from, st)
        census = new Map(Object.entries(t.file.rows).map(([g, r]) => [g, r.v[0]]))
      } catch {
        el('aggregate-result').replaceChildren(p(`The census population for ${levelWord(from)} is not built for this state, so it cannot be the weight. Choose a column of your own instead.`))
        return
      }
    }
    const agg = aggregate(base.applied.rows, from, to, file.headers, specs, { census, censusName: 'the 2020-2024 ACS population', childIds: base.ctx.lists[from]?.ids ?? null })
    const names = (await areaList(to, st, await loadIndex()))?.names ?? null
    const made = aggregatedTables(agg, names, (c) => `upload:agg:${c.spec.col}`)
    const out = el('aggregate-result')
    if (!made.length) {
      out.replaceChildren(p('Nothing could be added up with these choices.'), ...agg.columns.filter((c) => c.left).map((c) => p(`“${c.label}”: ${c.left}.`)))
      return
    }
    const tables = new Map()
    const measures = made.map(({ column, table }) => {
      const id = table.variables[0]
      tables.set(id, table)
      return {
        id,
        label: column.label,
        dataset: 'upload',
        table: id,
        est: [id],
        unit: 'number',
        ramp: 'Blues',
        upload: true,
        group: 'Your file',
        levels: [to],
        note: `From your file ${file.name}, ${column.how}. It stays in your browser.`,
      }
    })
    await apply({ measures, tables, level: to })
    const lines = aggregateRecipe(agg, from, to)
    out.replaceChildren(p(`${agg.coverage.parents} ${levelWord(to)} have a value. The map now shows your file at the ${LEVEL_WORD_ONE(to)} level.`), ...lines.map((l) => p(l)))
    el('upload-recipe-text').textContent = [...base.steps, ...lines].join('\n')
  }
  const LEVEL_WORD_ONE = (l) => ({ county: 'county', tract: 'tract', state: 'state' })[l] ?? l

  el('aggregate-make').addEventListener('click', () => makeAggregate().catch((err) => el('aggregate-result').replaceChildren(p(err.message))))
  el('aggregate-undo').addEventListener('click', () => process())

  el('upload-file').addEventListener('change', async (evt) => {
    const f = evt.target.files[0]
    if (!f) return
    try {
      const opened = await openText(f, ['.csv', '.txt', '.tsv'])
      const rows = parseCsv(opened.text)
      if (rows.length < 2) throw new Error('The file needs a header row and at least one row of data.')
      file = { name: opened.name, headers: rows[0].map((h) => h.trim()), body: rows.slice(1) }
      chosen = null
      await process()
    } catch (err) {
      file = null
      apply(null)
      el('upload-detect').replaceChildren()
      el('upload-report').replaceChildren(p(err.message))
    }
  })

  el('upload-download').addEventListener('click', () => {
    if (!download) return
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([download], { type: 'text/csv;charset=utf-8' })), download: 'rows-that-did-not-match.csv' })
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  })

  el('upload-recipe-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(el('upload-recipe-text').textContent)
      el('upload-recipe-copy').textContent = 'Copied'
      setTimeout(() => (el('upload-recipe-copy').textContent = 'Copy'), 1500)
    } catch {
      // Clipboard blocked: the text is on the page to select.
    }
  })

  el('upload-clear').addEventListener('click', () => {
    file = null
    chosen = null
    el('upload-file').value = ''
    process()
  })

  // A change of state changes what the file matches (names, ZIP codes, split codes), so it is read again.
  return { showReport: () => process() }
}
