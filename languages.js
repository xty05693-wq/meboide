import { javascript } from '@codemirror/lang-javascript'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'

const extOf = (name) => {
  const i = name.lastIndexOf('.')
  return i === -1 ? '' : name.slice(i + 1).toLowerCase()
}

const map = {
  js: () => javascript(),
  jsx: () => javascript({ jsx: true }),
  mjs: () => javascript(),
  cjs: () => javascript(),
  ts: () => javascript({ typescript: true }),
  tsx: () => javascript({ jsx: true, typescript: true }),
  html: () => html(),
  htm: () => html(),
  css: () => css(),
  scss: () => css(),
  less: () => css(),
  json: () => json(),
  jsonc: () => json(),
  md: () => markdown(),
  markdown: () => markdown(),
  py: () => python(),
}

// Возвращает расширение CodeMirror для языка файла (или [] — обычный текст)
export const langFor = (name) => (map[extOf(name)]?.() ?? [])

export const langLabel = (name) => {
  const e = extOf(name)
  return e ? e.toUpperCase().slice(0, 4) : 'TXT'
}
