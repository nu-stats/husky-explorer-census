// The request box on the map page. A person types what they want (or skips the
// typing and uses the menus); the box shows what it understood, in a sentence
// and a set of menus they can change, and nothing is drawn until they press
// "Yes, show it".
import { check, describe, interpret } from './lib/ask.js'
import { SITE } from './lib/site.js'

const make = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props)
  e.append(...kids)
  return e
}

/**
 * @param {{
 *   measures: object[],
 *   built: Record<string, { name: string, levels: string[], datasets: string[] }>,
 *   loadCounties: (state: string) => Promise<{ geoid: string, name: string }[]>,
 *   apply: (request: import('./lib/ask.js').Request) => Promise<void>,
 * }} setup
 */
export function setupAsk({ measures, built, loadCounties, apply }) {
  const form = document.getElementById('ask-form')
  const input = document.getElementById('ask-text')
  const card = document.getElementById('ask-card')
  let counties = null
  const states = Object.entries(built)
    .map(([fips, s]) => ({ fips, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  async function world() {
    counties ??= (await Promise.all(Object.keys(built).map((s) => loadCounties(s).catch(() => [])))).flat()
    return { measures, states, counties, built }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const text = input.value.trim()
    if (!text) return
    const w = await world()
    const found = interpret(text, w)
    render(w, found.request, found.alternatives, found.ambiguous, '')
  })

  function render(w, request, alternatives, ambiguous, firstNote) {
    const sentence = make('p', { className: 'understood' })
    const notes = make('ul', { className: 'notes' })
    const menus = make('div', { className: 'menus' })
    const go = make('button', { type: 'button', textContent: 'Yes, show it', className: 'primary' })
    const cancel = make('button', { type: 'button', textContent: 'Cancel' })

    const select = (label, options, value, onChange) => {
      const s = make('select')
      for (const o of options) s.append(typeof o.append === 'function' ? o : new Option(o.label, o.value))
      s.value = value ?? ''
      s.addEventListener('change', () => onChange(s.value))
      return make('label', {}, label, s)
    }

    const refresh = () => {
      sentence.textContent = describe(request, w)
      const problems = check(request, w)
      notes.replaceChildren(
        ...[firstNote, ...ambiguous.map((g) => `“${g[0].name.split(',')[0]}” is in more than one state (${g.map((c) => c.name.split(', ')[1]).join(', ')}). Choose the state and place below.`), ...problems]
          .filter(Boolean)
          .map((t) => make('li', { textContent: t })),
      )
      go.disabled = problems.length > 0
      drawMenus()
    }

    const groupedMeasures = () => {
      const groups = new Map()
      for (const m of measures) {
        const name = m.group ?? 'Census'
        if (!groups.has(name)) groups.set(name, make('optgroup', { label: name }))
        groups.get(name).append(new Option(m.label, m.id))
      }
      return [{ label: 'Choose…', value: '' }, ...groups.values()]
    }

    const drawMenus = () => {
      const here = w.counties.filter((c) => request.state && c.geoid.startsWith(request.state)).sort((a, b) => a.name.localeCompare(b.name))
      const placeMenu = (i) =>
        select(
          request.action === 'compare' ? `Place ${i + 1}` : 'Place',
          [{ label: request.action === 'compare' ? 'Choose…' : 'Whole state', value: '' }, ...here.map((c) => ({ label: c.name.split(',')[0], value: c.geoid }))],
          request.counties[i],
          (v) => {
            request.counties[i] = v
            request.counties = request.counties.filter(Boolean)
            refresh()
          },
        )
      const count = request.action === 'compare' ? 3 : 1
      menus.replaceChildren(
        select('Do', [{ label: 'Show on the map', value: 'map' }, { label: 'Compare places', value: 'compare' }], request.action, (v) => {
          request.action = v
          refresh()
        }),
        select('Data', groupedMeasures(), request.measureId, (v) => {
          request.measureId = v || null
          refresh()
        }),
        select('State', [{ label: 'Choose…', value: '' }, ...states.map((s) => ({ label: s.name, value: s.fips }))], request.state, (v) => {
          request.state = v || null
          request.counties = []
          refresh()
        }),
        ...Array.from({ length: count }, (_, i) => placeMenu(i)),
        select(
          'Areas',
          [
            { label: 'Best fit', value: 'auto' },
            { label: 'Counties', value: 'county' },
            { label: 'Towns and townships', value: 'cousub' },
    { label: 'ZIP code areas', value: 'zcta' },
            { label: 'Cities and places', value: 'place' },
            { label: 'Tracts', value: 'tract' },
            { label: 'Block groups', value: 'blockgroup' },
          ].filter((o) => !SITE?.dropLevels?.includes(o.value)),
          request.level,
          (v) => {
            request.level = v
            refresh()
          },
        ),
      )
    }

    go.addEventListener('click', async () => {
      go.disabled = true
      try {
        await apply({ ...request, counties: [...request.counties] })
        card.hidden = true
      } catch (err) {
        notes.replaceChildren(make('li', { textContent: err.message }))
        go.disabled = false
      }
    })
    cancel.addEventListener('click', () => (card.hidden = true))

    const maybe = alternatives.length
      ? make(
          'p',
          { className: 'note' },
          'It could also mean: ',
          ...alternatives.flatMap((m) => [
            make('button', {
              type: 'button',
              className: 'link',
              textContent: m.label,
              onclick: () => {
                request.measureId = m.id
                refresh()
              },
            }),
            ' ',
          ]),
        )
      : ''
    card.replaceChildren(make('h2', { textContent: 'Here is what I understood' }), sentence, notes, maybe, menus, make('div', { className: 'buttons' }, go, cancel))
    card.hidden = false
    refresh()
  }

  // The menus alone, with nothing filled in, for a person who would rather not type.
  document.getElementById('ask-menus').addEventListener('click', async () => {
    const w = await world()
    render(w, { action: 'map', measureId: null, state: null, counties: [], level: 'auto' }, [], [], '')
  })
}
