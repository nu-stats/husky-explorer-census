// Sending Explorer data to another Craft on this computer, by the Craft hand-off protocol (MapCraft's docs/handoff.md, version 1):
// the sender opens the receiver at `#from=explorer`, waits for the receiver's `<receiver>:ready` message, then posts one message
// to that origin only. Loopback addresses only. If no ready message comes, the caller saves a file instead. Nothing here changes
// another Craft: a receiver has to know the sender `explorer` (see plan/craft-links.md); until it does, the wait times out and the
// file fallback runs.

/** Loopback origins only: the hand-off never crosses the network. */
export function isLoopbackAddress(address) {
  try {
    const u = new URL(address)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const h = u.hostname.replace(/^\[|\]$/g, '').toLowerCase()
    return h === '127.0.0.1' || h === 'localhost' || h === '::1' || h.endsWith('.localhost')
  } catch {
    return false
  }
}

/** The Craft apps that take a browser hand-off, with the name each uses for its ready message. */
export const RECEIVERS = [
  { id: 'mapcraft', name: 'MapCraft', ready: 'mapcraft:ready', takes: ['table', 'layer'] },
  { id: 'hev', name: 'Husky Eye View', ready: 'hev:ready', takes: ['table', 'layer'] },
  { id: 'mergecraft', name: 'MergeCraft', ready: 'mergecraft:ready', takes: ['table'] },
]

/**
 * The messages Explorer sends. `csv` is a rendering for receivers that read CSV; `columns` says what each column is so a
 * receiver that understands it can keep labels, units, and the pairing of margins with estimates.
 * @param {{ fileName: string, csv: string, columns: object[], notices: string[], geography?: object }} t
 */
export const tableMessage = (t) => ({ type: 'explorer:table', version: 1, fileName: t.fileName, csv: t.csv, columns: t.columns, notices: t.notices, geography: t.geography ?? null })

export const layerMessage = (t) => ({ type: 'explorer:layer', version: 1, fileName: t.fileName, name: t.name ?? t.fileName, geojson: t.geojson, source: t.source ?? '', license: t.license ?? '', notices: t.notices })

/**
 * Open the receiver and post the message when it says it is ready.
 * @param {{ address: string, receiver: { ready: string }, message: object, timeoutMs?: number,
 *   open?: (url: string) => any, listen?: (fn: (evt: any) => void) => () => void, wait?: (ms: number, fn: () => void) => () => void }} o
 * @returns {Promise<'sent' | 'timeout' | 'blocked' | 'not-loopback'>}
 */
export function sendToCraft(o) {
  if (!isLoopbackAddress(o.address)) return Promise.resolve('not-loopback')
  const origin = new URL(o.address).origin
  const open = o.open ?? ((url) => window.open(url, '_blank'))
  const listen = o.listen ?? ((fn) => (window.addEventListener('message', fn), () => window.removeEventListener('message', fn)))
  const wait = o.wait ?? ((ms, fn) => {
    const t = setTimeout(fn, ms)
    return () => clearTimeout(t)
  })
  const target = `${origin}${new URL(o.address).pathname}#from=explorer`
  const win = open(target)
  if (!win) return Promise.resolve('blocked')
  return new Promise((resolve) => {
    let stop = () => {}
    let cancel = () => {}
    const done = (result) => {
      stop()
      cancel()
      resolve(result)
    }
    stop = listen((evt) => {
      if (evt.source !== win || evt.origin !== origin) return
      if (!evt.data || evt.data.type !== o.receiver.ready || evt.data.version !== 1) return
      win.postMessage(o.message, origin) // to that window's origin, never '*'
      done('sent')
    })
    cancel = wait(o.timeoutMs ?? 20000, () => done('timeout'))
  })
}
