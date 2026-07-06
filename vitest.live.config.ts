import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

/** Live suite: runs the cleanup fixtures against the real local Ollama model. */
export default defineConfig({
  resolve: {
    alias: { '@shared': resolve(__dirname, 'src/shared') }
  },
  test: {
    include: ['tests/live/**/*.test.ts'],
    testTimeout: 180_000,
    hookTimeout: 60_000,
    // Sequential: one model request at a time keeps VRAM stable and output deterministic.
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } }
  }
})
