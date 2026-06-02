// Separate from vite.config.ts so vitest uses this file exclusively and never
// loads the project's vite 8.x (which requires rolldown / Node 20).
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
