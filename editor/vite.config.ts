import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const engine_preset = process.env.SERAPHIM_PRESET ?? 'web-debug'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      seraphim: fileURLToPath(new URL(`../build/${engine_preset}`, import.meta.url)),
    },
  },
  server: {
    fs: { allow: ['..'] },
  },
})
