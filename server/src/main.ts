import { readFile } from 'node:fs/promises'
import create_engine from '../../build/web-debug/seraphim_server.mjs'
import { start_network } from './network.js'

const port = 9001
const tick_rate = 60
const tick_ms = 1000 / tick_rate
// Matches core::fixed_timestep: after a stall the server skips time instead of running a burst of catch-up ticks.
const max_frame_ms = 250

const [scene_path, watched_name] = process.argv.slice(2)
if (!scene_path) {
  console.error('Usage: npm start -- <path to a .scene.json> [entity name to log]')
  process.exit(1)
}

const engine = await create_engine()
const problem = engine.Server.load_scene(await readFile(scene_path, 'utf8'))
if (problem) {
  console.error(`The scene was rejected: ${problem}`)
  process.exit(1)
}
engine.Server.start_simulation()
console.log(`Simulating ${scene_path} at ${tick_rate} Hz`)

start_network(port, {
  connected: (connection) => console.log(`Connection ${connection.id} opened`),
  disconnected: (connection) => console.log(`Connection ${connection.id} closed`),
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
