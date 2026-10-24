import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import create_engine from '../../build/web-debug/seraphim_server.mjs'
import { run_scripts, type ScriptedEntity } from '../../runtime/script_host.ts'
import { create_world_api } from '../../runtime/world_api.ts'
import { start_network } from './network.js'
import { create_players } from './players.js'

const port = 9001
const tick_rate = 60
const tick_ms = 1000 / tick_rate
// Matches core::fixed_timestep: after a stall the server skips time instead of running a burst of catch-up ticks.
const max_frame_ms = 250

const [project_path, watched_name] = process.argv.slice(2)
if (!project_path) {
  console.error('Usage: npm start -- <project folder> [entity name to log]')
  process.exit(1)
}

const scene_path = join(project_path, 'scenes', 'main.scene.json')
const scene_text = await readFile(scene_path, 'utf8')
const engine = await create_engine()
const problem = engine.Server.load_scene(scene_text)
if (problem) {
  console.error(`The scene was rejected: ${problem}`)
  process.exit(1)
}

// The editor writes the bundle on Play, so the server runs the scripts as the last Play compiled them.
const bundle_path = join(project_path, '.seraphim', 'server.js')
let code = ''
if (existsSync(bundle_path)) {
  code = await readFile(bundle_path, 'utf8')
} else {
  console.warn(`${bundle_path} is missing, so no scripts run; pressing Play in the editor writes it`)
}
const { entities } = JSON.parse(scene_text) as { entities: ScriptedEntity[] }
const players = create_players()
const api = { ...create_world_api(engine.World, tick_ms / 1000), players: players.list }
run_scripts(engine.World, api, code, entities)

engine.Server.start_simulation()
console.log(`Simulating ${scene_path} at ${tick_rate} Hz`)

start_network(port, {
  connected: (connection) => {
    players.add(connection.id)
    console.log(`Player ${connection.id} joined`)
  },
  disconnected: (connection) => {
    players.remove(connection.id)
    console.log(`Player ${connection.id} left`)
  },
  received: (connection, message) => players.receive(connection.id, message),
})

function log_watched(tick: number): void {
  if (!watched_name) {
    return
  }
  const id = engine.World.find_entity(watched_name)
  const transform = id ? (engine.World.get_transform(id) as { x: number; y: number } | null) : null
  const where = transform ? `(${transform.x.toFixed(2)}, ${transform.y.toFixed(2)})` : 'not found'
  console.log(`tick ${tick}: ${watched_name} ${where}`)
}

let tick = 0
let last = performance.now()
let accumulator = 0

// setInterval drifts, so the elapsed time decides how many fixed ticks are due.
setInterval(() => {
  const now = performance.now()
  accumulator = Math.min(accumulator + now - last, max_frame_ms)
  last = now
  while (accumulator >= tick_ms) {
    accumulator -= tick_ms
    engine.Server.tick(tick_ms / 1000)
    tick += 1
    if (tick % tick_rate === 0) {
      log_watched(tick)
    }
  }
}, 1)
