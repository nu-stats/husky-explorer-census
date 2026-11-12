// Reads a file a person picked in a file box, opening it first when it is compressed (.zip, .gz, .bz2, .tar and the
// combinations). When an archive holds several files that fit, a small window asks which one to use.
import { offered, unpack } from './lib/unpack.js'

const utf8 = new TextDecoder()

function choose(files, title) {
  return new Promise((resolve, reject) => {
    const dialog = document.createElement('dialog')
    dialog.className = 'pick-file'
    const head = document.createElement('p')
    head.textContent = title
    const list = document.createElement('ul')
    for (const f of files) {
      const li = document.createElement('li')
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'link'
      b.textContent = `${f.name} (${f.bytes.length >= 1e6 ? `${(f.bytes.length / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(f.bytes.length / 1e3))} KB`})`
      b.addEventListener('click', () => {
        dialog.close()
        resolve(f)
      })
      li.append(b)
      list.append(li)
    }
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.textContent = 'Cancel'
    cancel.addEventListener('click', () => dialog.close())
    dialog.addEventListener('close', () => {
      dialog.remove()
      reject(new Error('No file was chosen from the archive.'))
    })
    dialog.append(head, list, cancel)
    document.body.append(dialog)
    dialog.showModal()
  })
}

// { name, bytes } of the file to use: the picked file itself, or the one chosen from inside it.
export async function openFile(file, extensions) {
  const files = await unpack(new Uint8Array(await file.arrayBuffer()), file.name)
  if (!files.length) throw new Error(`"${file.name}" has no files in it.`)
  const fit = offered(files, extensions)
  return fit.length === 1 ? fit[0] : choose(fit, `"${file.name}" holds ${fit.length} files. Which one?`)
}

// { name, text } for boxes that read text (CSV, JSON).
export async function openText(file, extensions) {
  const f = await openFile(file, extensions)
  return { name: f.name, text: utf8.decode(f.bytes) }
}
