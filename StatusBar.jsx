import { langLabel } from '../languages.js'

export default function StatusBar({ root, active, cursor }) {
  return (
    <div className="statusbar">
      <div className="sb-left">
        {root && <span className="folder">📁 {root.name}</span>}
        {active && <span className="path">{active.path || active.name}</span>}
        {!root && !active && <span>Готов к работе</span>}
      </div>
      <div className="sb-right">
        {active ? (
          <>
            <span>UTF-8</span>
            <span>{langLabel(active.name)}</span>
            <span className={active.dirty ? 'saved-no' : 'saved-yes'}>
              {active.dirty ? '● не сохранено' : '✓ сохранено'}
            </span>
            <span>Стр {cursor.line}, Кол {cursor.col}</span>
          </>
        ) : (
          <span>meboide v0.1</span>
        )}
      </div>
    </div>
  )
}
