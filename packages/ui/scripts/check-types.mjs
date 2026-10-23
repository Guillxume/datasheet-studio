// Runs Are the Types Wrong (attw) on every public entry point. attw does not
// expand wildcard exports such as "./components/*", so the entry points are
// listed from dist/. ESM-only profile: the package ships no CommonJS.
// Run after `pnpm build`.
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'

const modules = dir =>
  readdirSync(`dist/${dir}`, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.js'))
    .map(entry => `./${dir}/${entry.name.replace(/\.js$/, '')}`)

const entrypoints = [
  ...modules('components'),
  './components/mobile-nav',
  './components/scanner-input',
  ...modules('hooks'),
  ...modules('lib'),
]

const { status } = spawnSync(
  'attw',
  [
    '--pack',
    '.',
    '--profile',
    'esm-only',
    '--format',
    'table-flipped',
    '--entrypoints',
    ...entrypoints,
  ],
  { stdio: 'inherit', shell: process.platform === 'win32' },
)
process.exit(status ?? 1)
