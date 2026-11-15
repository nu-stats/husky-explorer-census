// A list of things to pick from, as a listbox where a plain click picks one, ctrl-click (cmd-click) toggles one and
// shift-click takes the range, with the arrow keys, Space and Ctrl+A for the keyboard. Used wherever a page offers
// a list of measures or tables.
import { moveFocus, selectAll, selectClick } from './multiselect.js'

/**
 * @param {HTMLElement} box the element to fill; it becomes the listbox
 * @param {{ onChange: (selected: string[], last: string | null) => void }} options last is the item clicked last
 */
export function createPicker(box, { onChange }) {
  let order = []
  let state = { selected: [], anchor: null }
  box.setAttribute('role', 'listbox')
  box.setAttribute('aria-multiselectable', 'true')
  const options = () => [...box.querySelectorAll('[role="option"]')]

  function paint() {
    const on = new Set(state.selected)
    const all = options()
    const tab = all.find((o) => o.dataset.id === state.anchor) ?? all[0]
    for (const o of all) {
      o.setAttribute('aria-selected', String(on.has(o.dataset.id)))
      o.tabIndex = o === tab ? 0 : -1
    }
  }
  function choose(next, fire = true) {
    state = next
    paint()
    if (fire) onChange([...state.selected], state.anchor)
  }
  const focusOn = (id) => options().find((o) => o.dataset.id === id)?.focus()

  box.addEventListener('mousedown', (e) => {
    if (e.shiftKey) e.preventDefault() // no text selection while taking a range
  })
  box.addEventListener('click', (e) => {
    const o = e.target.closest('[role="option"]')
    if (!o) return
    o.focus()
    choose(selectClick(state, order, o.dataset.id, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey }))
  })
  box.addEventListener('keydown', (e) => {
    const o = e.target.closest('[role="option"]')
    if (!o) return
    const id = o.dataset.id
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault()
      return choose(selectAll(order))
    }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      // Space toggles like ctrl-click; shift+Space takes the range.
      return choose(selectClick(state, order, id, { ctrl: !e.shiftKey, shift: e.shiftKey }))
    }
    const to = moveFocus(order, id, e.key)
    if (!to) return
    e.preventDefault()
    focusOn(to)
    // Shift+arrow extends the range from the anchor; ctrl+arrow only moves the focus; a bare arrow picks the one.
    if (e.shiftKey) choose(selectClick(state.anchor === null ? { selected: state.selected, anchor: id } : state, order, to, { shift: true }))
    else if (!(e.ctrlKey || e.metaKey)) choose(selectClick(state, order, to))
  })

  return {
    /** Fill the list: [{ id, label, group?, hint? }]. Picks no longer listed are dropped. */
    setItems(items) {
      box.replaceChildren()
      order = []
      let group = null
      for (const it of items) {
        if (it.group && it.group !== group) {
          group = it.group
          const h = Object.assign(document.createElement('div'), { className: 'pick-group', textContent: group })
          h.setAttribute('role', 'presentation')
          box.append(h)
        }
        order.push(it.id)
        const o = Object.assign(document.createElement('div'), { textContent: it.label })
        o.setAttribute('role', 'option')
        o.dataset.id = it.id
        if (it.hint) o.title = it.hint
        box.append(o)
      }
      state = { selected: state.selected.filter((id) => order.includes(id)), anchor: state.anchor }
      paint()
    },
    /** Set the picks without firing onChange. */
    select(ids) {
      const sel = order.filter((id) => ids.includes(id))
      state = { selected: sel, anchor: sel[0] ?? null }
      paint()
    },
    all: () => choose(selectAll(order)),
    clear: () => choose({ selected: [], anchor: null }),
    selected: () => [...state.selected],
    count: () => order.length,
  }
}
