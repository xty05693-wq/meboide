import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import FileChip from './FileChip.jsx'

export default function Sidebar({
  root, tree, activePath, supported,
  onOpenFolder, onRefresh, onOpenFile,
  onCreateFile, onCreateFolder, onDelete, onReloadDir,
}) {
  const [expanded, setExpanded] = useState(() => new Set())
  const [menu, setMenu] = useState(null)
  const menuRef = useRef(null)

  // Новая корневая папка — старое дерево раскрытых узлов к ней не относится.
  useEffect(() => {
    setExpanded(new Set())
    setMenu(null)
  }, [root])

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [menu])

  // Не даём контекстному меню уйти за границы окна.
  useLayoutEffect(() => {
    const el = menuRef.current
    if (!menu || !el) return
    const rect = el.getBoundingClientRect()
    el.style.left = `${Math.max(8, Math.min(menu.x, window.innerWidth - rect.width - 8))}px`
    el.style.top = `${Math.max(8, Math.min(menu.y, window.innerHeight - rect.height - 8))}px`
  }, [menu])

  const rootNode = root
    ? { kind: 'directory', name: root.name, path: '', handle: root, children: tree }
    : null

  const toggle = async (node) => {
    const isOpen = expanded.has(node.path)
    setExpanded((prev) => {
      const next = new Set(prev)
      if (isOpen) next.delete(node.path)
      else next.add(node.path)
      return next
    })
    if (!isOpen && node.children === null) await onReloadDir(node)
  }

  const openMenu = (e, node, parent) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, node, parent })
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <span>ПРОВОДНИК</span>
        {root && (
          <div className="sidebar-head-actions">
            <button className="icon-btn" title="Сменить папку" onClick={onOpenFolder}>📂</button>
            <button className="icon-btn" title="Обновить дерево файлов" onClick={onRefresh}>⟳</button>
          </div>
        )}
      </div>

      {!root && (
        <div className="sidebar-empty">
          <p>Папка не открыта</p>
          {supported && (
            <button className="btn ghost" onClick={onOpenFolder}>Открыть папку</button>
          )}
          {!supported && (
            <p className="hint">
              Для работы с реальными файлами<br />откройте meboide в Chrome или Edge.
            </p>
          )}
        </div>
      )}

      {root && (
        <>
          <div className="tree">
            {tree.map((n) => (
              <TreeItem
                key={n.path}
                node={n}
                depth={0}
                parent={rootNode}
                expanded={expanded}
                toggle={toggle}
                activePath={activePath}
                onOpenFile={onOpenFile}
                openMenu={openMenu}
                onReloadDir={onReloadDir}
              />
            ))}
            {tree.length === 0 && <div className="tree-empty">Папка пуста</div>}
          </div>
          <div className="sidebar-foot">
            <button className="mini-btn" title="Новый файл в корне папки" onClick={() => onCreateFile(rootNode)}>+ файл</button>
            <button className="mini-btn" title="Новая папка в корне" onClick={() => onCreateFolder(rootNode)}>+ папка</button>
          </div>
        </>
      )}

      {menu && (
        <div className="context-menu" ref={menuRef} style={{ left: menu.x, top: menu.y }}>
          {menu.node.kind === 'directory' ? (
            <>
              <button onClick={() => { setMenu(null); onCreateFile(menu.node) }}>Новый файл</button>
              <button onClick={() => { setMenu(null); onCreateFolder(menu.node) }}>Новая папка</button>
              <button onClick={() => { setMenu(null); onReloadDir(menu.node) }}>Обновить</button>
              {menu.node.path !== '' && (
                <button className="danger" onClick={() => { setMenu(null); onDelete(menu.parent, menu.node) }}>Удалить</button>
              )}
            </>
          ) : (
            <>
              <button onClick={() => { setMenu(null); onOpenFile(menu.node) }}>Открыть</button>
              <button className="danger" onClick={() => { setMenu(null); onDelete(menu.parent, menu.node) }}>Удалить</button>
            </>
          )}
        </div>
      )}
    </aside>
  )
}

function TreeItem({ node, depth, parent, expanded, toggle, activePath, onOpenFile, openMenu, onReloadDir }) {
  const isDir = node.kind === 'directory'
  const open = expanded.has(node.path)
  return (
    <>
      <div
        className={`tree-item ${isDir ? 'dir' : 'file'}${activePath === node.path ? ' active' : ''}`}
        style={{ paddingLeft: 10 + depth * 12 }}
        onClick={() => (isDir ? toggle(node) : onOpenFile(node))}
        onContextMenu={(e) => openMenu(e, node, parent)}
        title={node.path}
      >
        <span className="chevron">{isDir ? (open ? '▾' : '▸') : ''}</span>
        {isDir
          ? <span className="icon">{open ? '📂' : '📁'}</span>
          : <FileChip name={node.name} />}
        <span className="name">{node.name}</span>
      </div>
      {isDir && open && (node.children ?? []).map((c) => (
        <TreeItem
          key={c.path}
          node={c}
          depth={depth + 1}
          parent={node}
          expanded={expanded}
          toggle={toggle}
          activePath={activePath}
          onOpenFile={onOpenFile}
          openMenu={openMenu}
          onReloadDir={onReloadDir}
        />
      ))}
    </>
  )
}
