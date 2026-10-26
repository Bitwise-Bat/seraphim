import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import create_engine from '../../build/web-debug/seraphim_server.mjs'
import { run_scripts, type ScriptedEntity } from '../../runtime/script_host.ts'
import { create_world_api } from '../../runtime/world_api.ts'
import { start_network } from './network.js'
import { create_events } from './events.js'
import { create_players } from './players.js'

const port = 9001
const tick_rate = 60
const tick_ms = 1000 / tick_rate
// Snapshots go out every third tick (20 Hz); the client interpolates between them.
const snapshot_ticks = 3
// Matches core::fixed_timestep: after a stall the server skips time instead of running a burst of catch-up ticks.
const max_frame_ms = 250

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason)
})

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
const events = create_events()

type SpawnOptions = {
  name: string
  owner_id?: number
  position?: [number, number]
  sprite?: string
  order?: number
  animation_set?: string
}

type NetworkHandle = ReturnType<typeof start_network>
let network: NetworkHandle | undefined
const spawned_entities = new Map<string, SpawnOptions & { id: string }>()

function broadcast(message: unknown): void {
  if (!network) return
  const text = JSON.stringify(message)
  for (const player of players.list()) {
    network.send(player.id, text)
  }
}

function send_to(player_id: number, message: unknown): void {
  network?.send(player_id, JSON.stringify(message))
}

const server = {
  on: events.on,
  off: events.off,
  send(player_id: number, name: string, data: unknown): void {
    send_to(player_id, { type: 'event', name, data })
  },
  broadcast(name: string, data: unknown): void {
    broadcast({ type: 'event', name, data })
  },
  spawn(options: SpawnOptions): string {
    const id = engine.World.create_entity(options.name)
    engine.World.add_component(id, 'transform')
    engine.World.add_component(id, 'networked')
    const set_owner = (engine.World as unknown as { set_owner_id?: (id: string, owner: number) => void }).set_owner_id
    if (options.owner_id !== undefined && set_owner) {
      set_owner(id, options.owner_id)
    }
    if (options.position) {
      engine.World.set_transform(id, options.position[0], options.position[1], 0, 1, 1)
    }
    if (options.sprite) {
      engine.World.add_component(id, 'sprite')
      engine.World.set_sprite(id, options.sprite, options.order ?? 10)
    }
    if (options.animation_set) {
      engine.World.add_component(id, 'animator')
      engine.World.set_animation_set(id, options.animation_set)
    }

    const entity_data = {
      id,
      name: options.name,
      owner_id: options.owner_id,
      position: options.position ?? [0, 0],
      sprite: options.sprite,
      order: options.order ?? 10,
      animation_set: options.animation_set,
    }
    spawned_entities.set(id, entity_data)
    broadcast({ type: 'spawn_entity', entity: entity_data })

    return id
  },
  despawn(id: string): void {
    spawned_entities.delete(id)
    broadcast({ type: 'despawn_entity', id })
  },
  set_clip(id: string,  clip: string): void {
    engine.World.set_clip(id,  clip);
    broadcast({ type: 'anim_clip_changed', clip, id})
  }
}

const api = { ...create_world_api(engine.World, tick_ms / 1000), players: players.list, server }
run_scripts(engine.World, api, code, entities)

engine.Server.start_simulation()
console.log(`Simulating ${scene_path} at ${tick_rate} Hz`)

network = start_network(port, {
  connected: (connection) => {
    players.add(connection.id)
    console.log(`Player ${connection.id} joined`)

    for (const entity of spawned_entities.values()) {
      send_to(connection.id, { type: 'spawn_entity', entity })
    }

    const player = players.get(connection.id)
    if (player) {
      events.emit('connected', player, {})
      events.emit('player_join', player, {})
    }
  },
  disconnected: (connection) => {
    const player = players.get(connection.id)
    if (player) {
      events.emit('player_leave', player, {})
    }
    players.remove(connection.id)
    console.log(`Player ${connection.id} left`)
  },
  received: (connection, message) => {
    players.receive(connection.id, message)
    events.receive(connection.id, message)
  },
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
    events.dispatch(players.get)
    engine.Server.tick(tick_ms / 1000)
    tick += 1
    if (tick % snapshot_ticks === 0) {
      const snapshot = engine.World.make_snapshot(-1e4, -1e4, 1e4, 1e4)
      for (const player of players.list()) network?.send(player.id, snapshot)
    }
    if (tick % tick_rate === 0) {
      log_watched(tick)
    }
  }
}, 1)
