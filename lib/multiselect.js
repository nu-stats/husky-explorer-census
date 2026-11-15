// Picking several items from a list the way a file list does: a plain click picks one, ctrl-click
// (cmd-click on a Mac) adds or removes one, shift-click takes the range from the last click.

/**
 * @param {{ selected: string[], anchor: string | null }} state the picks so far, and the item last clicked
 * @param {string[]} order the ids as listed on screen
 * @param {string} id the item clicked
 * @param {{ ctrl?: boolean, shift?: boolean }} keys
 * @returns {{ selected: string[], anchor: string | null }} the picks in list order
 */
export function selectClick(state, order, id, keys = {}) {
  const at = order.indexOf(id)
  if (at < 0) return state
  const have = new Set(state.selected.filter((s) => order.includes(s)))
  const from = state.anchor !== null && order.includes(state.anchor) ? order.indexOf(state.anchor) : at
  let next
  if (keys.shift) {
    const range = order.slice(Math.min(from, at), Math.max(from, at) + 1)
    // Shift alone replaces the picks with the range; ctrl+shift adds the range to them.
    next = new Set(keys.ctrl ? [...have, ...range] : range)
    return { selected: order.filter((s) => next.has(s)), anchor: order[from] }
  }
  if (keys.ctrl) {
    next = new Set(have)
    if (!next.delete(id)) next.add(id)
  } else next = new Set([id])
  return { selected: order.filter((s) => next.has(s)), anchor: id }
}

/** Every listed item (ctrl+A). */
export const selectAll = (order) => ({ selected: [...order], anchor: order[0] ?? null })

/** The item a key press moves to from the focused one, or null when it stays. */
export function moveFocus(order, id, key) {
  const at = order.indexOf(id)
  if (key === 'ArrowDown') return order[Math.min(order.length - 1, at + 1)] ?? null
  if (key === 'ArrowUp') return order[Math.max(0, at - 1)] ?? null
  if (key === 'Home') return order[0] ?? null
  if (key === 'End') return order.at(-1) ?? null
  return null
}

/**
 * For a list of tick boxes, where a plain click toggles one: shift-click sets everything from the last click
 * to this one to the state the clicked box just took. Returns the new ticked ids and the new last click.
 * @param {{ ticked: string[], anchor: string | null }} state the ticks before the click
 * @param {string} id the box clicked
 * @param {boolean} on the state the click gave it
 */
export function tickClick(state, order, id, on, shift) {
  const at = order.indexOf(id)
  if (at < 0) return state
  const from = shift && state.anchor !== null && order.includes(state.anchor) ? order.indexOf(state.anchor) : at
  const span = new Set(order.slice(Math.min(from, at), Math.max(from, at) + 1))
  const ticked = order.filter((s) => (span.has(s) ? on : state.ticked.includes(s)))
  return { ticked, anchor: id }
}
