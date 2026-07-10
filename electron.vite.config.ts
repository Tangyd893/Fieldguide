import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        // Bundle JS-only deps; keep pdf-parse external (pulls ESM pdfjs-dist if bundled)
        exclude: ['simple-git', '@electron-toolkit/utils'],
      }),
    ],
    build: {
      rollupOptions: {
        external: ['better-sqlite3', 'electron', 'pdf-parse'],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve('src/renderer')
      }
    }
  }
})
