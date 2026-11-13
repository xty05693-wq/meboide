// Файловый слой meboide:
//  - в десктоп-сборке (Electron) — через IPC-мост window.mebofs (настоящий доступ к диску)
//  - в браузере — File System Access API (Chrome / Edge)
//
// «handle» — объект-ручка файла/папки:
//  - Electron: { absPath, name, kind }  (абсолютный путь на диске)
//  - Браузер:  FileSystemDirectoryHandle / FileSystemFileHandle

const bridge = typeof window !== 'undefined' ? window.mebofs : null
const el = !!bridge

const IGNORED = new Set([
  'node_modules', '.git', 'dist', 'build', 'out',
  '.next', '.cache', 'coverage', '.venv', '__pycache__',
])

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 МБ — защита от случайного открытия огромных файлов

const hasWindowFn = (name) =>
  typeof window !== 'undefined' && typeof window[name] === 'function'

export const fsSupported = () => el || hasWindowFn('showDirectoryPicker')

// «Сохранить как» в браузере доступно не во всех движках, где есть выбор папки.
export const canSaveAs = () => el || hasWindowFn('showSaveFilePicker')

function abortError() {
  const e = new Error('Отменено пользователем')
  e.name = 'AbortError'
  return e
}

/* ================= Electron ================= */

async function elPickRoot() {
  const dir = await bridge.pickFolder()
  if (!dir) throw abortError()
  // Возвращаем сам handle, а не обёртку: App/Sidebar везде работают с
  // handle.absPath (listDir, createFile, refreshTree и т.д.).
  return { absPath: dir.path, name: dir.name, kind: 'directory' }
}

const elRequestRW = async () => true

async function elListDir(handle, parentPath = '') {
  const entries = await bridge.listDir(handle.absPath)
  return entries.map((e) => {
    const node = {
      name: e.name,
      path: parentPath ? `${parentPath}/${e.name}` : e.name,
      kind: e.kind,
      handle: { absPath: e.path, name: e.name, kind: e.kind },
    }
    if (e.kind === 'directory') node.children = null
    return node
  })
}

const elReadFile = (handle) => bridge.readFile(handle.absPath)
const elWriteFile = (handle, content) => bridge.writeFile(handle.absPath, content)

async function elCreateFile(dirHandle, name) {
  const abs = await bridge.createFile(dirHandle.absPath, name)
  return { absPath: abs, name, kind: 'file' }
}

const elCreateFolder = (dirHandle, name) => bridge.createFolder(dirHandle.absPath, name)
const elDeleteEntry = (dirHandle, name, kind) => bridge.deleteEntry(dirHandle.absPath, name, kind)

async function elSaveAs(content, suggestedName) {
  const res = await bridge.saveAs(content, suggestedName)
  if (!res) throw abortError()
  return { absPath: res.path, name: res.name, kind: 'file' }
}

/* ================= Браузер ================= */

async function webPickRoot() {
  return window.showDirectoryPicker({ id: 'meboide-root', mode: 'readwrite' })
}

async function webRequestRW(handle) {
  const opts = { mode: 'readwrite' }
  if ((await handle.queryPermission?.(opts)) === 'granted') return true
  return (await handle.requestPermission?.(opts)) === 'granted'
}

async function webListDir(dirHandle, parentPath = '') {
  const entries = []
  for await (const entry of dirHandle.values()) {
    if (IGNORED.has(entry.name)) continue
    const path = parentPath ? `${parentPath}/${entry.name}` : entry.name
    entries.push(
      entry.kind === 'directory'
        ? { name: entry.name, path, kind: 'directory', handle: entry, children: null }
        : { name: entry.name, path, kind: 'file', handle: entry },
    )
  }
  entries.sort((a, b) =>
    a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1,
  )
  return entries
}

const webReadFile = async (fileHandle) => {
  const file = await fileHandle.getFile()
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`Файл слишком большой (${Math.round(file.size / 1024 / 1024)} МБ). Максимум — 10 МБ.`)
  }
  // Бинарные файлы (изображения, архивы, exe) нельзя корректно открыть как текст.
  const head = new Uint8Array(await file.slice(0, 8192).arrayBuffer())
  if (head.includes(0)) {
    throw new Error('Похоже, это бинарный файл — его нельзя открыть в текстовом редакторе.')
  }
  return file.text()
}

async function webWriteFile(fileHandle, content) {
  const w = await fileHandle.createWritable()
  await w.write(content)
  await w.close()
}

async function webCreateFile(dirHandle, name) {
  let existing = null
  try {
    existing = await dirHandle.getFileHandle(name)
  } catch (e) {
    if (e?.name !== 'NotFoundError') throw e
  }
  if (existing) throw new Error(`"${name}" уже существует`)
  const fh = await dirHandle.getFileHandle(name, { create: true })
  await webWriteFile(fh, '')
  return fh
}

async function webCreateFolder(dirHandle, name) {
  let existing = null
  try {
    existing = await dirHandle.getDirectoryHandle(name)
  } catch (e) {
    if (e?.name !== 'NotFoundError') throw e
  }
  if (existing) throw new Error(`"${name}" уже существует`)
  return dirHandle.getDirectoryHandle(name, { create: true })
}

const webDeleteEntry = (dirHandle, name, kind) =>
  kind === 'directory'
    ? dirHandle.removeEntry(name, { recursive: true })
    : dirHandle.removeEntry(name)

async function webSaveAs(content, suggestedName = 'untitled.txt') {
  const handle = await window.showSaveFilePicker({ suggestedName })
  await webWriteFile(handle, content)
  return handle
}

/* ================= Общие ================= */

async function sameEntry(a, b) {
  if (!a || !b) return false
  if (a.absPath || b.absPath) return !!a.absPath && !!b.absPath && a.absPath === b.absPath
  if (typeof a.isSameEntry === 'function') {
    try { return await a.isSameEntry(b) } catch { return false }
  }
  return false
}

/* ================= Публичный API ================= */

export const pickRoot = el ? elPickRoot : webPickRoot
export const requestRW = el ? elRequestRW : webRequestRW
export const listDir = el ? elListDir : webListDir
export const readFile = el ? elReadFile : webReadFile
export const writeFile = el ? elWriteFile : webWriteFile
export const createFile = el ? elCreateFile : webCreateFile
export const createFolder = el ? elCreateFolder : webCreateFolder
export const deleteEntry = el ? elDeleteEntry : webDeleteEntry
export const saveAs = el ? elSaveAs : webSaveAs
export const isSameEntry = sameEntry
