import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Для десктоп-сборки (Electron) всё собирается в один index.html —
// тогда окно грузит его через file:// без CORS-проблем с ES-модулями.
export default defineConfig(({ command }) => ({
  plugins: [react(), ...(command === 'build' ? [viteSingleFile()] : [])],
  base: './',
  server: {
    port: 5173,
  },
}))
