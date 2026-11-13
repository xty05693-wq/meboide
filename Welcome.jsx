export default function Welcome({ supported, hasFolder, onOpenFolder, onNewFile }) {
  return (
    <div className="welcome">
      <div className="welcome-card">
        <div className="logo-big">meboide</div>
        <p className="tagline">
          Лёгкая IDE в браузере: проводник файлов, вкладки и подсветка синтаксиса.
        </p>
        <div className="welcome-actions">
          <button className="btn" onClick={onNewFile}>Новый файл</button>
          {supported && (
            <button className="btn ghost" onClick={onOpenFolder}>
              {hasFolder ? 'Сменить папку' : 'Открыть папку'}
            </button>
          )}
        </div>
        {!supported && (
          <p className="hint">Для работы с реальными файлами откройте meboide в Chrome или Edge.</p>
        )}
        <p className="hint">Ctrl+S — сохранить файл</p>
      </div>
    </div>
  )
}
