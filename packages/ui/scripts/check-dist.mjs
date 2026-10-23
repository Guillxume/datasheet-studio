// Checks what the build must guarantee and no compiler warning reports:
// - every source module has its .js and .d.ts in dist/;
// - 'use client' is on the first line of exactly the dist files whose source
//   starts with it (a lost directive turns a client component into a server
//   one, which only fails at runtime in the app);
// - relative imports in dist/ carry their extension, for strict ESM resolvers.
// Run after `pnpm build`. Exits 1 and lists every problem found.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = 'src'
const DIST = 'dist'
const EXCLUDED =
  /(^|\/)(__tests__|stories)\/|\.test\.tsx?$|\.stories\.tsx$|^test-setup\.ts$/
const CLIENT_DIRECTIVE = /^\s*['"]use client['"];?\s*$/

const walk = dir =>
  readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })

const problems = []
const sources = walk(SRC)
  .map(path => relative(SRC, path))
  .filter(path => /\.tsx?$/.test(path) && !path.endsWith('.d.ts'))
  .filter(path => !EXCLUDED.test(path))

for (const source of sources) {
  const base = source.replace(/\.tsx?$/, '')
  const js = join(DIST, `${base}.js`)
  const dts = join(DIST, `${base}.d.ts`)
  if (!existsSync(js)) problems.push(`missing ${js}`)
  if (!existsSync(dts)) problems.push(`missing ${dts}`)
  if (!existsSync(js)) continue

  const sourceIsClient = CLIENT_DIRECTIVE.test(
    readFileSync(join(SRC, source), 'utf8').split('\n')[0],
  )
  const jsLines = readFileSync(js, 'utf8').split('\n')
  const distIsClient = CLIENT_DIRECTIVE.test(jsLines[0])
  if (sourceIsClient && !distIsClient)
    problems.push(`'use client' lost in ${js}`)
  if (!sourceIsClient && distIsClient)
    problems.push(`'use client' added in ${js}`)

  for (const line of jsLines) {
    const match = line.match(
      /(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/,
    )
    if (match && !/\.(js|css)$/.test(match[1]))
      problems.push(`extensionless import "${match[1]}" in ${js}`)
  }
}

if (problems.length > 0) {
  console.error(
    `check-dist: ${problems.length} problem(s)\n${problems.join('\n')}`,
  )
  process.exit(1)
}
console.log(`check-dist: ${sources.length} modules OK`)
