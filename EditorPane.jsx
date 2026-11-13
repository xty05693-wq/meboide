import { useEffect, useRef, useState } from 'react'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { basicSetup } from 'codemirror'
import { oneDark } from '@codemirror/theme-one-dark'
import { langFor } from '../languages.js'

export default function EditorPane({ tabs, activeId, onContentChange, onCursor }) {
  const hostRef = useRef(null)
  const viewRef = useRef(null)
  const statesRef = useRef(new Map())   // id вкладки -> EditorState (курсор и история правок)
  const prevActiveRef = useRef(null)
  const tabsRef = useRef(tabs); tabsRef.current = tabs
  const activeIdRef = useRef(activeId); activeIdRef.current = activeId
  const cbRef = useRef({}); cbRef.current = { onContentChange, onCursor }
  const langRef = useRef(new Compartment())
  const [ready, setReady] = useState(false)
  const activeName = tabs.find((t) => t.id === activeId)?.name ?? ''

  function extensionsFor(tab) {
    return [
      basicSetup,
      oneDark,
      EditorView.theme({
        '&': { fontSize: '13.5px', height: '100%' },
        '.cm-scroller': { fontFamily: 'var(--mono)' },
        '.cm-gutters': { background: 'transparent', borderRight: '1px solid var(--border)' },
        '.cm-activeLine': { background: '#ffffff06' },
        '.cm-activeLineGutter': { background: '#ffffff0a' },
      }),
      langRef.current.of(langFor(tab?.name ?? '')),
      keymap.of([indentWithTab]),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) {
          cbRef.current.onContentChange(activeIdRef.current, u.state.doc.toString())
        }
        if (u.selectionSet || u.docChanged) {
          const sel = u.state.selection.main
          const line = u.state.doc.lineAt(sel.head)
          cbRef.current.onCursor(line.number, sel.head - line.from + 1)
        }
      }),
    ]
  }

  // Однократное создание редактора
  useEffect(() => {
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({ doc: '', extensions: extensionsFor(null) }),
    })
    viewRef.current = view
    setReady(true)
    return () => {
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Переключение вкладок: сохраняем/восстанавливаем состояния
  useEffect(() => {
    const view = viewRef.current
    if (!view || !activeId) return
    const tab = tabsRef.current.find((t) => t.id === activeId)
    if (!tab) return

    if (prevActiveRef.current && prevActiveRef.current !== activeId
        && tabsRef.current.some((t) => t.id === prevActiveRef.current)) {
      statesRef.current.set(prevActiveRef.current, view.state)
    }

    let state = statesRef.current.get(activeId)
    // файл изменился извне, а мы его не редактировали — подгружаем заново
    if (state && !tab.dirty && tab.content !== state.doc.toString()) state = null
    if (!state) {
      state = EditorState.create({ doc: tab.content ?? '', extensions: extensionsFor(tab) })
      statesRef.current.set(activeId, state)
    }

    view.setState(state)
    view.focus()
    prevActiveRef.current = activeId

    const sel = state.selection.main
    const line = state.doc.lineAt(sel.head)
    cbRef.current.onCursor(line.number, sel.head - line.from + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, ready])

  // После «Сохранить как» имя файла меняется — обновляем подсветку синтаксиса
  // без переоткрытия вкладки.
  useEffect(() => {
    const view = viewRef.current
    if (!view || !activeId) return
    view.dispatch({ effects: langRef.current.reconfigure(langFor(activeName)) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, activeName])

  // Чистим состояния вкладок, закрытых неактивными (эффект выше срабатывает
  // только при смене activeId, поэтому сам по себе их не удаляет).
  useEffect(() => {
    const ids = new Set(tabs.map((t) => t.id))
    for (const k of [...statesRef.current.keys()]) {
      if (!ids.has(k)) statesRef.current.delete(k)
    }
  }, [tabs])

  return <div className="editor-host" ref={hostRef} />
}
