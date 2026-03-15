import { join, resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const root = process.cwd()

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    root,
    build: {
      rollupOptions: {
        input: join(root, 'index.html')
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve(root, 'src')
      }
    },
    plugins: [react()]
  }
})
