import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['worker/index.ts'],
  outDir: 'dist/worker',
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  bundle: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  noExternal: ['pg-boss', 'postgres', 'zod'],
  banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' }
})
