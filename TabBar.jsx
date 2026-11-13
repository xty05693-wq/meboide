export default function TabBar({ tabs, activeId, onSelect, onClose }) {
  return (
    <div className="tabbar">
      {tabs.map((t) => (
        <div
          key={t.id}
          className={`tab${t.id === activeId ? ' active' : ''}`}
          title={t.path || 'Новый файл (в памяти)'}
          onClick={() => onSelect(t.id)}
          onMouseDown={(e) => { if (e.button === 1) e.preventDefault() }}
          onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); onClose(t.id) } }}
        >
          <span className="tab-name">{t.name}</span>
          {t.dirty && <span className="dot" title="Не сохранено" />}
          <button
            className="close"
            title="Закрыть"
            onClick={(e) => { e.stopPropagation(); onClose(t.id) }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
