import { useCallback, useEffect, useRef, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import TabBar from './components/TabBar.jsx'
import EditorPane from './components/EditorPane.jsx'
import StatusBar from './components/StatusBar.jsx'
import Welcome from './components/Welcome.jsx'
import * as fs from './fs.js'

let untitledSeq = 0

// Свежий список папки не содержит содержимого вложенных папок — сохраняем
// уже загруженные children, иначе раскрытые узлы после обновления исчезают.
function mergeChildren(prevNodes, nextNodes) {
  if (!prevNodes?.length) return nextNodes
  const prevByPath = new Map(prevNodes.map((n) => [n.path, n]))
  return nextNodes.map((n) => {
    const old = prevByPath.get(n.path)
    if (old && n.kind === 'directory' && Array.isArray(old.children)) {
      return { ...n, children: old.children }
    }
    return n
  })
}

function replaceChildren(nodes, dirPath, children) {
  return nodes.map((n) => {
    if (n.kind !== 'directory') return n
    if (n.path === dirPath) return { ...n, children: mergeChildren(n.children, children) }
    if (n.children) return { ...n, children: replaceChildren(n.children, dirPath, children) }
    return n
  })
}

function closeTabs(tabs, ids, currentActiveId) {
  const doomed = new Set(ids)
  const next = tabs.filter((t) => !doomed.has(t.id))
  const activeId = doomed.has(currentActiveId)
    ? (next.length ? next[next.length - 1].id : null)
    : currentActiveId
  return { next, activeId }
}

// Вкладки, относящиеся к файлу/папке из дерева.
function tabsForEntry(tabs, node) {
  return node.kind === 'file'
    ? tabs.filter((t) => t.path === node.path)
    : tabs.filter((t) => t.fromRoot && (t.path === node.path || t.path.startsWith(node.path + '/')))
}

// Имена, которые нельзя создавать на диске (особенно в Windows/Electron).
function checkEntryName(name) {
  if (!name) return 'Имя не может быть пустым.'
  if (name === '.' || name === '..') return 'Недопустимое имя.'
  if (/[\\/:*?"<>|]/.test(name)) return 'Имя содержит недопустимые символы: \\ / : * ? " < > |'
  return null
}

export default function App() {
  const [root, setRoot] = useState(null)          // корневой дескриптор папки (File System Access)
  const [tree, setTree] = useState([])            // дерево файлов корня
  const [tabs, setTabs] = useState([])            // открытые вкладки
  const [activeId, setActiveId] = useState(null)
  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  // fs.fsSupported — функция; без вызова в state попадала бы сама функция,
  // из-за чего кнопки «Открыть папку» показывались даже в неподдерживаемом браузере.
  const [supported] = useState(() => fs.fsSupported())

  const tabsRef = useRef(tabs); tabsRef.current = tabs
  const activeIdRef = useRef(activeId); activeIdRef.current = activeId
  const rootRef = useRef(root); rootRef.current = root

  const active = tabs.find((t) => t.id === activeId) ?? null

  useEffect(() => {
    document.title = active ? `${active.name} — meboide` : 'meboide'
  }, [active])

  // Предупреждаем при закрытии/перезагрузке окна с несохранёнными файлами.
  const hasDirty = tabs.some((t) => t.dirty)
  useEffect(() => {
    if (!hasDirty) return
    const onBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [hasDirty])

  /* ---------- папка и дерево ---------- */

  const openFolder = useCallback(async () => {
    try {
      const handle = await fs.pickRoot()
      const ok = await fs.requestRW(handle)
      if (!ok) { window.alert('Доступ к папке не разрешён.'); return }

      // Сначала читаем содержимое, чтобы при ошибке не потерять текущую папку.
      const children = await fs.listDir(handle)
      const prev = rootRef.current
      const sameRoot = await fs.isSameEntry(prev, handle)

      let keptTabs = tabsRef.current
      if (prev && !sameRoot) {
        // Вкладки файлов старой папки закрываем: путь (id вкладки) относителен
        // корня, и в новой папке он мог бы совпасть с другим файлом.
        const stale = tabsRef.current.filter((t) => t.fromRoot)
        const dirty = stale.filter((t) => t.dirty)
        if (dirty.length && !window.confirm(
          `В текущей папке есть несохранённые файлы (${dirty.length}). ` +
          'Закрыть их без сохранения и открыть другую папку?',
        )) return
        const doomed = new Set(stale.map((t) => t.id))
        keptTabs = tabsRef.current.filter((t) => !doomed.has(t.id))
      }

      // Для той же папки оставляем прежний handle, чтобы не сбрасывать
      // раскрытые узлы дерева без необходимости.
      if (!sameRoot || !prev) setRoot(handle)
      setTree(children)
      if (keptTabs !== tabsRef.current) {
        setTabs(keptTabs)
        setActiveId((cur) => (
          keptTabs.some((t) => t.id === cur)
            ? cur
            : (keptTabs.length ? keptTabs[keptTabs.length - 1].id : null)
        ))
      }
    } catch (e) {
      if (e?.name !== 'AbortError') window.alert('Не удалось открыть папку: ' + (e?.message ?? e))
    }
  }, [])

  const refreshTree = useCallback(async () => {
    const r = rootRef.current
    if (!r) return
    try {
      const children = await fs.listDir(r)
      setTree((tr) => mergeChildren(tr, children))
    } catch (e) { console.error(e) }
  }, [])

  const reloadDir = useCallback(async (dirNode) => {
    if (!dirNode?.handle) return
    try {
      const children = await fs.listDir(dirNode.handle, dirNode.path)
      if (!dirNode.path) setTree((tr) => mergeChildren(tr, children))
      else setTree((tr) => replaceChildren(tr, dirNode.path, children))
    } catch (e) { console.error(e) }
  }, [])

  /* ---------- вкладки ---------- */

  const openFile = useCallback(async (node) => {
    if (node.kind !== 'file') return
    const id = node.path
    if (tabsRef.current.some((t) => t.id === id)) { setActiveId(id); return }
    try {
      const content = await fs.readFile(node.handle)
      setTabs((ts) => [
        ...ts,
        {
          id, name: node.name, path: node.path, handle: node.handle,
          content, savedContent: content, dirty: false, fromRoot: true,
        },
      ])
      setActiveId(id)
    } catch (e) {
      window.alert('Не удалось открыть файл: ' + (e?.message ?? e))
    }
  }, [])

  const handleContentChange = useCallback((id, doc) => {
    setTabs((ts) => ts.map((t) => (t.id === id ? { ...t, content: doc, dirty: doc !== t.savedContent } : t)))
  }, [])

  const setCursorOf = useCallback((line, col) => setCursor({ line, col }), [])

  const newUntitled = useCallback(() => {
    untitledSeq += 1
    const n = untitledSeq
    const id = `untitled:${n}`
    setTabs((ts) => [
      ...ts,
      { id, name: `untitled-${n}.txt`, path: '', handle: null, content: '', savedContent: '', dirty: false, fromRoot: false },
    ])
    setActiveId(id)
  }, [])

  const closeTab = useCallback((id) => {
    const t = tabsRef.current.find((x) => x.id === id)
    if (!t) return
    if (t.dirty && !window.confirm(`"${t.name}" содержит несохранённые изменения. Закрыть без сохранения?`)) return
    const { next, activeId: nextActive } = closeTabs(tabsRef.current, [id], activeIdRef.current)
    setTabs(next)
    setActiveId(nextActive)
  }, [])

  /* ---------- сохранение ---------- */

  const saveTab = useCallback(async (tab) => {
    if (!tab) return
    // Берём актуальную версию вкладки: пока шёл диалог/запись, текст мог измениться.
    const current = tabsRef.current.find((t) => t.id === tab.id)
    if (!current) return
    const content = current.content

    const markSaved = (patch = {}) => setTabs((ts) => ts.map((t) => (
      t.id === current.id
        // dirty пересчитываем по текущему тексту: набор во время записи не теряется.
        ? { ...t, ...patch, savedContent: content, dirty: t.content !== content }
        : t
    )))

    try {
      if (current.handle) {
        await fs.writeFile(current.handle, content)
        markSaved()
      } else if (fs.canSaveAs()) {
        const handle = await fs.saveAs(content, current.name)
        markSaved({
          handle,
          name: handle.name,
          path: handle.absPath ?? handle.name,
        })
      } else {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = current.name
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        a.remove()
        // Не отзываем URL синхронно — иначе загрузка может отмениться.
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        markSaved()
      }
    } catch (e) {
      if (e?.name !== 'AbortError') window.alert('Не удалось сохранить: ' + (e?.message ?? e))
    }
  }, [])

  const saveTabRef = useRef(saveTab); saveTabRef.current = saveTab

  const saveActive = useCallback(() => {
    const t = tabsRef.current.find((x) => x.id === activeIdRef.current)
    if (t) saveTabRef.current(t)
  }, [])
  const saveActiveRef = useRef(saveActive); saveActiveRef.current = saveActive

  useEffect(() => {
    const h = (e) => {
      const key = (e.key || '').toLowerCase()
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (key === 's' || e.code === 'KeyS')) {
        e.preventDefault()
        e.stopPropagation()
        saveActiveRef.current()
      }
    }
    window.addEventListener('keydown', h, true)
    return () => window.removeEventListener('keydown', h, true)
  }, [])

  /* ---------- файловые операции в проводнике ---------- */

  const createFileIn = useCallback(async (dirNode) => {
    const name = window.prompt('Имя нового файла:', 'untitled.js')
    if (!name) return
    const trimmed = name.trim()
    const nameError = checkEntryName(trimmed)
    if (nameError) { window.alert(nameError); return }
    try {
      const fh = await fs.createFile(dirNode.handle, trimmed)
      await reloadDir(dirNode)
      const path = dirNode.path ? `${dirNode.path}/${fh.name}` : fh.name
      const id = path
      if (!tabsRef.current.some((t) => t.id === id)) {
        setTabs((ts) => [
          ...ts,
          {
            id, name: fh.name, path, handle: fh,
            content: '', savedContent: '', dirty: false, fromRoot: true,
          },
        ])
      }
      setActiveId(id)
    } catch (e) {
      window.alert('Не удалось создать файл: ' + (e?.message ?? e))
    }
  }, [reloadDir])

  const createFolderIn = useCallback(async (dirNode) => {
    const name = window.prompt('Имя новой папки:', 'new-folder')
    if (!name) return
    const trimmed = name.trim()
    const nameError = checkEntryName(trimmed)
    if (nameError) { window.alert(nameError); return }
    try {
      await fs.createFolder(dirNode.handle, trimmed)
      await reloadDir(dirNode)
    } catch (e) {
      window.alert('Не удалось создать папку: ' + (e?.message ?? e))
    }
  }, [reloadDir])

  const removeEntry = useCallback(async (parentNode, node) => {
    const what = node.kind === 'directory' ? 'папку' : 'файл'
    const affected = tabsForEntry(tabsRef.current, node)
    const dirtyCount = affected.filter((t) => t.dirty).length
    const warning = dirtyCount
      ? ` В открытых вкладках есть несохранённые изменения (${dirtyCount}).`
      : ''
    if (!window.confirm(`Удалить ${what} "${node.name}"?${warning}`)) return
    try {
      await fs.deleteEntry(parentNode.handle, node.name, node.kind)
      await reloadDir(parentNode)
      const ids = tabsForEntry(tabsRef.current, node).map((t) => t.id)
      if (ids.length) {
        const { next, activeId: nextActive } = closeTabs(tabsRef.current, ids, activeIdRef.current)
        setTabs(next)
        setActiveId(nextActive)
      }
    } catch (e) {
      window.alert('Не удалось удалить: ' + (e?.message ?? e))
    }
  }, [reloadDir])

  /* ---------- render ---------- */

  return (
    <div className="app">
      <div className="activity">
        <div className="logo" title="meboide">m</div>
      </div>

      <Sidebar
        root={root}
        tree={tree}
        activePath={active?.path ?? null}
        supported={supported}
        onOpenFolder={openFolder}
        onRefresh={refreshTree}
        onOpenFile={openFile}
        onCreateFile={createFileIn}
        onCreateFolder={createFolderIn}
        onDelete={removeEntry}
        onReloadDir={reloadDir}
      />

      <main className="main">
        <TabBar tabs={tabs} activeId={activeId} onSelect={setActiveId} onClose={closeTab} />

        {active ? (
          <EditorPane
            tabs={tabs}
            activeId={activeId}
            onContentChange={handleContentChange}
            onCursor={setCursorOf}
          />
        ) : (
          <Welcome
            supported={supported}
            hasFolder={!!root}
            onOpenFolder={openFolder}
            onNewFile={newUntitled}
          />
        )}

        <StatusBar root={root} active={active} cursor={cursor} />
      </main>
    </div>
  )
}
