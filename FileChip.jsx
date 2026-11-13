const COLORS = {
  js: '#f5d64e', jsx: '#61dafb', mjs: '#f5d64e', cjs: '#f5d64e',
  ts: '#4b8bbe', tsx: '#61dafb',
  html: '#e44d26', htm: '#e44d26',
  css: '#42a5f5', scss: '#cf649a', less: '#5b6bbf',
  json: '#cbcb41', md: '#9aa4b2', py: '#4b8bbe',
  txt: '#8b91a0',
  png: '#a074c4', jpg: '#a074c4', jpeg: '#a074c4', gif: '#a074c4', svg: '#ffb13b',
}

export default function FileChip({ name }) {
  const i = name.lastIndexOf('.')
  const e = i === -1 ? 'txt' : name.slice(i + 1).toLowerCase()
  const label = e.slice(0, 3).toUpperCase()
  return (
    <span className="file-chip" style={{ background: COLORS[e] ?? '#8b91a0' }}>
      {label}
    </span>
  )
}
