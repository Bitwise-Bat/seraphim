import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig(({ command }) => {
  const engine_preset = process.env.SERAPHIM_PRESET ?? (command === 'build' ? 'web-release' : 'web-debug')

  return {
    plugins: [react()],
    base: "./",
    resolve: {
      alias: {
        seraphim: fileURLToPath(new URL(`../build/${engine_preset}`, import.meta.url)),
      },
    },
    server: {
      fs: { allow: ['..'] },
    },
  }
})
