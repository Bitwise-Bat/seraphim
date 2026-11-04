import { existsSync, readdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import create_engine from '../../build/web-debug/seraphim_server.mjs'
import { run_scripts, type ScriptedEntity } from '../../runtime/script_host.ts'
import { create_world_api } from '../../runtime/world_api.ts'
import { start_network } from './network.js'
import { create_events } from './events.js'
import { create_players } from './players.js'
import { db } from './db.ts'

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

const raw_args = process.argv.slice(2)
if (raw_args.length === 0) {
  console.error('Usage: npm start -- <project folder> [entity name to log]')
  process.exit(1)
}

function resolve_project_path(candidate: string): string | undefined {
  let p = candidate.replace(/^['"]|['"]$/g, '').replace(/^seraphim:\/\//, '').replace(/\/$/, '')
  try {
    p = decodeURIComponent(p)
  } catch {}
  if (existsSync(p)) return p
  if (process.env.USERPROFILE) {
    const doc = join(process.env.USERPROFILE, 'Documents', p)
    if (existsSync(doc)) return doc
  }
  return undefined
}

let project_path: string | undefined
let watched_name: string | undefined

for (let i = raw_args.length; i >= 1; i--) {
  const combined = raw_args.slice(0, i).join(' ')
  const resolved = resolve_project_path(combined)
  if (resolved) {
    project_path = resolved
    watched_name = raw_args.slice(i).join(' ') || undefined
    break
  }
}

if (!project_path) {
  project_path = resolve_project_path(raw_args[0]) || raw_args[0]
  watched_name = raw_args.slice(1).join(' ') || undefined
}

function find_scene_path(project: string): string | undefined {
  const direct_asset = join(project, 'assets', 'main.scene.json')
  if (existsSync(direct_asset)) return direct_asset

  const assets_dir = join(project, 'assets')
  if (existsSync(assets_dir)) {
    let fallback: string | undefined
    function walk(dir: string): string | undefined {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
          const found = walk(full)
          if (found) return found
        } else if (entry.isFile()) {
          if (entry.name.toLowerCase() === 'main.scene.json') {
            return full
          }
          if (!fallback && (entry.name.endsWith('.scene.json') || entry.name.endsWith('.scene'))) {
            fallback = full
          }
        }
      }
      return undefined
    }
    const found_main = walk(assets_dir)
    if (found_main) return found_main
    if (fallback) return fallback
  }

  const legacy = join(project, 'scenes', 'main.scene.json')
  if (existsSync(legacy)) return legacy
  return undefined
}

const scene_path = find_scene_path(project_path)
if (!scene_path) {
  console.error(`Could not find a scene file in ${project_path} (checked assets/ and scenes/)`)
  process.exit(1)
}

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

type SpriteLayer = {
  name: string
  texture: string
  order?: number
}

type SpawnOptions = {
  name: string
  owner_id?: number
  position?: [number, number]
  sprite?: string
  sprite_layers?: SpriteLayer[]
  order?: number
  animation_set?: string
}

type NetworkHandle = ReturnType<typeof start_network>
let network: NetworkHandle | undefined
const spawned_entities = new Map<string, SpawnOptions & { id: string }>()

function resolve_entity_id(id_or_name: string): string {
  if (spawned_entities.has(id_or_name)) return id_or_name
  for (const [entity_id, data] of spawned_entities) {
    if (data.name === id_or_name) return entity_id
  }
  return engine.World.find_entity(id_or_name) || id_or_name
}

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
    if (options.sprite || (options.sprite_layers && options.sprite_layers.length > 0)) {
      engine.World.add_component(id, 'sprite')
      engine.World.set_sprite(id, options.sprite ?? '', options.order ?? 10)
      if (options.sprite_layers) {
        const set_sprite_layer = (
          engine.World as unknown as {
            set_sprite_layer?: (id: string, name: string, texture: string, order: number) => void
          }
        ).set_sprite_layer
        for (const layer of options.sprite_layers) {
          set_sprite_layer?.(id, layer.name, layer.texture, layer.order ?? 0)
        }
      }
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
      sprite_layers: options.sprite_layers ? options.sprite_layers.map((l) => ({ ...l })) : undefined,
      order: options.order ?? 10,
      animation_set: options.animation_set,
    }
    spawned_entities.set(id, entity_data)
    broadcast({ type: 'spawn_entity', entity: entity_data })

    return id
  },
  despawn(id_or_name: string): void {
    const id = resolve_entity_id(id_or_name)
    spawned_entities.delete(id)
    engine.World.set_transform(id, -99999, -99999, 0, 0, 0)
    broadcast({ type: 'despawn_entity', id })
  },
  set_clip(id: string, clip: string): void {
    const resolved_id = resolve_entity_id(id)
    if (engine.World.get_clip(resolved_id) === clip) return
    engine.World.set_clip(resolved_id, clip)
    broadcast({ type: 'anim_clip_changed', clip, id: resolved_id })
  },
  set_sprite_layer(id: string, name: string, texture: string, order = 0): void {
    const resolved_id = resolve_entity_id(id)
    if (!engine.World.has_sprite(resolved_id)) {
      engine.World.add_component(resolved_id, 'sprite')
    }
    const world_any = engine.World as unknown as {
      set_sprite_layer?: (id: string, name: string, texture: string, order: number) => void
    }
    world_any.set_sprite_layer?.(resolved_id, name, texture, order)
    const spawned = spawned_entities.get(resolved_id)
    if (spawned) {
      spawned.sprite_layers ??= []
      const existing = spawned.sprite_layers.find((l) => l.name === name)
      if (existing) {
        existing.texture = texture
        existing.order = order
      } else {
        spawned.sprite_layers.push({ name, texture, order })
      }
    }
    broadcast({ type: 'sprite_layer_set', id: resolved_id, name, texture, order })
  },
  remove_sprite_layer(id: string, name: string): void {
    const resolved_id = resolve_entity_id(id)
    const world_any = engine.World as unknown as {
      remove_sprite_layer?: (id: string, name: string) => void
    }
    world_any.remove_sprite_layer?.(resolved_id, name)
    const spawned = spawned_entities.get(resolved_id)
    if (spawned?.sprite_layers) {
      spawned.sprite_layers = spawned.sprite_layers.filter((l) => l.name !== name)
    }
    broadcast({ type: 'sprite_layer_removed', id: resolved_id, name })
  },
  set_visibility_enter(cb: (observer: string, target: string) => void | null){
    engine.Server.set_visibility_enter_handler(cb)
  },
  set_visibility_leave(cb: (observer: string, target: string) => void | null){
    engine.Server.set_visibility_leave_handler(cb)
  },
  add_observer(id: string){
    engine.Server.add_observer(id)
  },
  remove_observer(id: string){
    engine.Server.remove_observer(id)
  },
  send_for_relevant(player_id: number, name: string, data: unknown){
    const entity = engine.World.find_entity(`player_${player_id}`)
    if (!entity) return
    
    const position = engine.World.get_transform(entity)
    if (!position) return

    const entities = engine.World.get_nearby_entities(position.x, position.y, 10)
    for (const ent of entities)
    {
      const owner_id = engine.World.get_owner_id(ent)
      if (!owner_id || owner_id === player_id) continue
      this.send(owner_id, name, data)
    }
  },
}

const api = { ...create_world_api(engine.World, tick_ms / 1000), players: players.list, server, db }
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
