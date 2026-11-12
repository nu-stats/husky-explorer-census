// A notebook is what a person adds to the map: pinned notes, and tour stops (a saved view with a
// caption, played back in order). It is plain data so it can be kept in the browser, saved to a file
// and opened by someone else; everything read from a file is checked here, because a file is not
// trusted. Functions return a new notebook and never change the one they are given.

export const LIMITS = { notes: 200, stops: 100, text: 500, title: 80, caption: 600 }

export const emptyNotebook = () => ({ app: 'husky-explorer', version: 1, notes: [], stops: [] })

const clip = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const finite = (x) => typeof x === 'number' && Number.isFinite(x)

const newId = (notes) => notes.reduce((top, n) => Math.max(top, n.id), 0) + 1

export function addNote(book, lon, lat, text) {
  const words = clip(text, LIMITS.text)
  if (!words) throw new Error('Write something in the note first.')
  if (!finite(lon) || !finite(lat) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error('That point is not on the map.')
  if (book.notes.length >= LIMITS.notes) throw new Error(`A notebook holds up to ${LIMITS.notes} notes.`)
  return { ...book, notes: [...book.notes, { id: newId(book.notes), lon, lat, text: words }] }
}

export const removeNote = (book, id) => ({ ...book, notes: book.notes.filter((n) => n.id !== id) })

/** A view is what a stop remembers: the state, the measure, how it is drawn and where the map is. */
export function cleanView(view) {
  const v = view ?? {}
  const center = Array.isArray(v.center) ? v.center : []
  if (typeof v.state !== 'string' || !/^\d{2}$/.test(v.state)) return null
  if (typeof v.measure !== 'string' || !v.measure || v.measure.length > 80) return null
  if (center.length !== 2 || !center.every(finite) || Math.abs(center[1]) > 90 || Math.abs(center[0]) > 180) return null
  if (!finite(v.zoom) || v.zoom < 0 || v.zoom > 24) return null
  const level = ['auto', 'county', 'cousub', 'place', 'zcta', 'tract', 'blockgroup'].includes(v.level) ? v.level : 'auto'
  const method = ['natural-breaks', 'quantile', 'equal-interval'].includes(v.method) ? v.method : 'natural-breaks'
  const count = Number.isInteger(v.count) && v.count >= 3 && v.count <= 7 ? v.count : 5
  return { state: v.state, measure: v.measure, level, method, count, center: [center[0], center[1]], zoom: v.zoom }
}

export function addStop(book, title, caption, view) {
  const clean = cleanView(view)
  if (!clean) throw new Error('This view cannot be saved as a stop.')
  const name = clip(title, LIMITS.title)
  if (!name) throw new Error('Give the stop a title.')
  if (book.stops.length >= LIMITS.stops) throw new Error(`A tour holds up to ${LIMITS.stops} stops.`)
  return { ...book, stops: [...book.stops, { title: name, caption: clip(caption, LIMITS.caption), view: clean }] }
}

export const removeStop = (book, index) => ({ ...book, stops: book.stops.filter((_, i) => i !== index) })

/** Moves a stop one place earlier (-1) or later (1); at either end nothing changes. */
export function moveStop(book, index, step) {
  const to = index + step
  if (index < 0 || index >= book.stops.length || to < 0 || to >= book.stops.length) return book
  const stops = [...book.stops]
  ;[stops[index], stops[to]] = [stops[to], stops[index]]
  return { ...book, stops }
}

export const serializeNotebook = (book) => JSON.stringify(book, null, 2) + '\n'

/**
 * Reads a notebook from text. Anything that is not a note or a stop is dropped, and the count of
 * what was dropped comes back so the person is told rather than left to wonder.
 * @returns {{ book: object, dropped: number }}
 */
export function parseNotebook(text) {
  let raw
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('That file is not a Husky Explorer notebook (it is not readable as JSON).')
  }
  if (!raw || typeof raw !== 'object' || raw.app !== 'husky-explorer' || !Array.isArray(raw.notes) || !Array.isArray(raw.stops)) {
    throw new Error('That file is not a Husky Explorer notebook.')
  }
  if (raw.version !== 1) throw new Error('That notebook was made by a newer version of Husky Explorer.')
  let dropped = 0
  const notes = []
  for (const n of raw.notes.slice(0, LIMITS.notes)) {
    const words = clip(n?.text, LIMITS.text)
    if (!words || !finite(n.lon) || !finite(n.lat) || Math.abs(n.lat) > 90 || Math.abs(n.lon) > 180) {
      dropped++
      continue
    }
    notes.push({ id: notes.length + 1, lon: n.lon, lat: n.lat, text: words })
  }
  const stops = []
  for (const s of raw.stops.slice(0, LIMITS.stops)) {
    const view = cleanView(s?.view)
    const title = clip(s?.title, LIMITS.title)
    if (!view || !title) {
      dropped++
      continue
    }
    stops.push({ title, caption: clip(s.caption, LIMITS.caption), view })
  }
  dropped += Math.max(0, raw.notes.length - LIMITS.notes) + Math.max(0, raw.stops.length - LIMITS.stops)
  return { book: { app: 'husky-explorer', version: 1, notes, stops }, dropped }
}
