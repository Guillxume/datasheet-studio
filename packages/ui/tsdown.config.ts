import { defineConfig } from 'tsdown'

// Choices measured in STK-559 (raw TS vs pre-compiled, tsup vs tsdown).
export default defineConfig(inlineConfig => ({
  entry: [
    'src/**/*.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.stories.tsx',
    '!src/stories/**',
    '!src/test-setup.ts',
  ],
  format: 'esm',
  // Front-end library: plain .js output, no Node built-ins
  platform: 'neutral',
  // One output module per source module: each 'use client' boundary stays
  // where it is in the source, and the app bundler can tree-shake.
  unbundle: true,
  // Declaration maps let "go to definition" open src/ instead of dist/
  dts: { sourcemap: true },
  sourcemap: true,
  // Emptying dist/ on every watch rebuild makes the app dev server briefly
  // see missing modules; only clean on one-off builds.
  clean: !inlineConfig.watch,
  target: 'es2022',
  outDir: 'dist',
  failOnWarn: true,
  checks: {
    // Raised for every 'use client' module although unbundled output keeps
    // them all; scripts/check-dist.mjs verifies that instead.
    moduleLevelDirective: false,
  },
}))
