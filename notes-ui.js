// "Notes and tours": pin short notes on the map, save views as tour stops with a caption, play the
// stops in order, and keep it all in the browser or in a file that can be handed to someone else.
import { openText } from './open-file.js'
import { addNote, addStop, emptyNotebook, moveStop, parseNotebook, removeNote, removeStop, serializeNotebook } from './lib/notebook.js'

const KEY = 'husky-explorer-notebook'

/**
 * @param {{ ol: any, map: any, el: (id: string) => HTMLElement, view: () => object,
 *   show: (view: object) => Promise<string> }} hooks `view` reads what the map shows now;
 *   `show` puts a saved view back and returns a plain-words remark when it could not be matched exactly.
 * @returns {{ placing: () => boolean }}
 */
export function setupNotes({ ol, map, el, view, show, picture, basemapOn }) {
  let book = emptyNotebook()
  let placing = false
  let playing = -1
  const source = new ol.source.Vector()
  const layer = new ol.layer.Vector({
    source,
    zIndex: 11,
    style: (feature) =>
      new ol.style.Style({
        image: new ol.style.Circle({ radius: 7, fill: new ol.style.Fill({ color: '#c8102e' }), stroke: new ol.style.Stroke({ color: '#fff', width: 2 }) }),
        text: new ol.style.Text({
          text: feature.get('text').length > 28 ? feature.get('text').slice(0, 27) + '…' : feature.get('text'),
          offsetY: -18,
          font: '600 12px system-ui, sans-serif',
          fill: new ol.style.Fill({ color: '#1a1a1a' }),
          stroke: new ol.style.Stroke({ color: '#fff', width: 3 }),
        }),
      }),
  })
  map.addLayer(layer)

  const say = (text) => {
    el('notes-status').textContent = text
  }

  function remember() {
    try {
      localStorage.setItem(KEY, serializeNotebook(book))
    } catch {
      // Storage can be blocked; the notebook still works until the page is closed, and can be saved to a file.
    }
  }

  function button(text, onClick, label) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'link'
    b.textContent = text
    if (label) b.setAttribute('aria-label', label)
    b.addEventListener('click', onClick)
    return b
  }

  function render() {
    source.clear()
    for (const n of book.notes) {
      const f = new ol.Feature({ geometry: new ol.geom.Point(ol.proj.fromLonLat([n.lon, n.lat])), text: n.text })
      f.set('noteId', n.id, true)
      source.addFeature(f)
    }
    el('note-list').replaceChildren(
      ...book.notes.map((n) => {
        const li = document.createElement('li')
        li.append(button(n.text.length > 60 ? n.text.slice(0, 59) + '…' : n.text, () => goTo(n), `Go to the note: ${n.text}`), ' ', button('remove', () => change(removeNote(book, n.id)), `Remove the note: ${n.text}`))
        return li
      }),
    )
    el('stop-list').replaceChildren(
      ...book.stops.map((s, i) => {
        const li = document.createElement('li')
        li.append(
          button(s.title, () => play(i), `Show stop ${i + 1}: ${s.title}`),
          ' ',
          button('up', () => change(moveStop(book, i, -1)), `Move ${s.title} earlier`),
          ' ',
          button('down', () => change(moveStop(book, i, 1)), `Move ${s.title} later`),
          ' ',
          button('remove', () => change(removeStop(book, i)), `Remove stop ${s.title}`),
        )
        return li
      }),
    )
    el('tour-play').disabled = !book.stops.length
    el('tour-pdf').disabled = !book.stops.length
    el('notes-summary').textContent = `${book.notes.length} note${book.notes.length === 1 ? '' : 's'}, ${book.stops.length} stop${book.stops.length === 1 ? '' : 's'}`
  }

  function change(next) {
    book = next
    remember()
    render()
    if (playing >= book.stops.length) closeTour()
  }

  const goTo = (n) => map.getView().animate({ center: ol.proj.fromLonLat([n.lon, n.lat]), duration: 300 })

  // --- notes
  const setPlacing = (on) => {
    placing = on
    el('note-place').textContent = on ? 'Click the map…' : 'Pin it on the map'
    map.getTargetElement().style.cursor = on ? 'crosshair' : ''
  }
  el('note-place').addEventListener('click', () => {
    if (placing) return setPlacing(false)
    if (!el('note-text').value.trim()) return say('Write something in the note first.')
    say('')
    setPlacing(true)
  })
  map.on('singleclick', (evt) => {
    if (placing) {
      setPlacing(false)
      const [lon, lat] = ol.proj.toLonLat(evt.coordinate)
      try {
        change(addNote(book, lon, lat, el('note-text').value))
        el('note-text').value = ''
        say('')
      } catch (err) {
        say(err.message)
      }
      return
    }
    const hit = map.forEachFeatureAtPixel(evt.pixel, (f) => f, { layerFilter: (l) => l === layer })
    if (hit) say(`Note: ${hit.get('text')}`)
  })

  // --- tour
  el('stop-add').addEventListener('click', () => {
    try {
      change(addStop(book, el('stop-title').value, el('stop-caption').value, view()))
      el('stop-title').value = ''
      el('stop-caption').value = ''
      say('')
    } catch (err) {
      say(err.message)
    }
  })

  async function play(i) {
    playing = i
    const stop = book.stops[i]
    const card = el('tour-card')
    card.hidden = false
    el('tour-count').textContent = `Stop ${i + 1} of ${book.stops.length}`
    el('tour-title').textContent = stop.title
    el('tour-caption').textContent = stop.caption
    el('tour-remark').textContent = ''
    el('tour-prev').disabled = i === 0
    el('tour-next').disabled = i === book.stops.length - 1
    const remark = await show(stop.view)
    // Only the stop still on the card gets the remark: a quick click past it would otherwise label the next one.
    if (playing === i) el('tour-remark').textContent = remark
  }
  function closeTour() {
    playing = -1
    el('tour-card').hidden = true
  }
  el('tour-play').addEventListener('click', () => play(0))
  el('tour-prev').addEventListener('click', () => playing > 0 && play(playing - 1))
  el('tour-next').addEventListener('click', () => playing >= 0 && playing < book.stops.length - 1 && play(playing + 1))
  el('tour-close').addEventListener('click', closeTour)
  document.addEventListener('keydown', (e) => {
    if (playing >= 0 && e.key === 'Escape') closeTour()
  })

  // --- print: one page per stop (title, caption, the map as it looked, its legend), then the pinned notes.
  // The browser's print dialog saves it as a PDF.
  const tag = (name, text, className) => Object.assign(document.createElement(name), { textContent: text ?? '', className: className ?? '' })

  async function printTour() {
    const before = view()
    closeTour()
    el('tour-pdf').disabled = true
    const story = tag('div', '', '')
    story.id = 'story'
    story.append(tag('h1', 'Husky Explorer tour'), tag('p', `${book.stops.length} stops, ${new Date().toLocaleDateString('en-US')}`, 'story-meta'))
    try {
      for (const [i, stop] of book.stops.entries()) {
        say(`Preparing page ${i + 1} of ${book.stops.length}…`)
        const remark = await show(stop.view)
        const page = tag('section', '', 'story-page')
        page.append(tag('h2', `${i + 1}. ${stop.title}`), tag('p', stop.caption))
        if (remark) page.append(tag('p', remark, 'story-meta'))
        const image = await picture()
        if (image) page.append(Object.assign(document.createElement('img'), { src: image, alt: `Map for stop ${i + 1}: ${stop.title}` }))
        else page.append(tag('p', 'The browser would not let the map be copied into this page.', 'story-meta'))
        const legend = el('legend').cloneNode(true)
        legend.removeAttribute('id')
        legend.className = 'story-legend'
        page.append(legend)
        story.append(page)
      }
      if (book.notes.length) {
        const page = tag('section', '', 'story-page')
        page.append(tag('h2', 'Notes'))
        const list = document.createElement('ul')
        for (const n of book.notes) list.append(tag('li', `${n.text} (${n.lat.toFixed(4)}, ${n.lon.toFixed(4)})`))
        page.append(list)
        story.append(page)
      }
      story.append(
        tag(
          'p',
          `${basemapOn() ? 'Street map © OpenStreetMap contributors. ' : ''}Data sources are listed on the Husky Explorer map page. This product uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau.`,
          'story-meta',
        ),
      )
      document.body.append(story)
      document.body.classList.add('printing-story')
      say('')
      const done = () => {
        story.remove()
        document.body.classList.remove('printing-story')
      }
      window.addEventListener('afterprint', done, { once: true })
      window.print()
    } catch (err) {
      say(`Could not prepare the pages: ${err.message}`)
    } finally {
      await show(before)
      el('tour-pdf').disabled = !book.stops.length
    }
  }
  el('tour-pdf').addEventListener('click', printTour)

  // --- file
  el('notes-save').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([serializeNotebook(book)], { type: 'application/json' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: 'husky-explorer-notebook.json' })
    a.click()
    URL.revokeObjectURL(url)
  })
  el('notes-open').addEventListener('change', async () => {
    const file = el('notes-open').files[0]
    el('notes-open').value = ''
    if (!file) return
    try {
      const { book: opened, dropped } = parseNotebook((await openText(file, ['.json'])).text)
      closeTour()
      change(opened)
      say(`Opened ${opened.notes.length} notes and ${opened.stops.length} stops${dropped ? `; ${dropped} damaged or surplus entr${dropped === 1 ? 'y was' : 'ies were'} left out` : ''}.`)
    } catch (err) {
      say(err.message)
    }
  })
  el('notes-clear').addEventListener('click', () => {
    if (!book.notes.length && !book.stops.length) return
    if (!confirm('Remove every note and tour stop? Save the notebook first to keep a copy.')) return
    closeTour()
    change(emptyNotebook())
    say('Cleared.')
  })

  try {
    const saved = localStorage.getItem(KEY)
    if (saved) book = parseNotebook(saved).book
  } catch {
    // Nothing saved, or saved by something else: start empty.
  }
  render()
  return { placing: () => placing }
}
