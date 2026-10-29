import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

let raw = process.argv[2] || ''
raw = raw.replace(/^['"]|['"]$/g, '')
raw = raw.replace(/^seraphim:\/\//, '').replace(/\/$/, '')

try {
  raw = decodeURIComponent(raw)
} catch {}

let projectPath = raw
if (!existsSync(projectPath)) {
  const docPath = join(homedir(), 'Documents', raw)
  if (existsSync(docPath)) {
    projectPath = docPath
  }
}

console.log(`Starting Seraphim server for: "${projectPath}"`)

const child = spawn('npm', ['start', '--', `"${projectPath}"`], {
  stdio: 'inherit',
  cwd: import.meta.dirname,
  shell: true,
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})
