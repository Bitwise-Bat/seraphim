import type { MainModule } from 'seraphim/seraphim.js'
import { key_codes, type KeyName } from '../scripting/keys'

export const server_url = 'ws://localhost:9001'
const send_interval_ms = 1000 / 60
// Matches the server, which sends a snapshot every third 60 Hz tick.
const snapshot_interval = 3 / 60

type spawned_entity_payload = {
  id: string
  name: string
  owner_id?: number
  position?: [number, number]
  sprite?: string
  order?: number
  animation_set?: string
}

type snapshot_entity = { id: string; position: [number, number]; rotation: number; clip: string, scale: [number, number] }

type placement = { x: number; y: number; rotation: number; scale_x: number; scale_y: number }

// Where a networked entity was drawn when the last snapshot came, where that snapshot puts it, and how far along it is.
type interpolation = {
  from: [number, number]
  to: [number, number]
  from_rotation: number
  to_rotation: number
  scale: [number, number]
  alpha: number
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// Turns the short way round, so 350 to 10 degrees goes forward by 20 instead of back by 340.
function lerp_angle(a: number, b: number, t: number): number {
  let difference = (b - a) % (Math.PI * 2)
  if (difference > Math.PI) difference -= Math.PI * 2
  if (difference < -Math.PI) difference += Math.PI * 2
  return a + difference * t
}

export type ServerConnection = {
  // Messages sent before the connection opens wait for it; without a server they are dropped.
  send: (message: unknown) => void
  on: (name: string, handler: (data: unknown) => void) => void
  off: (name: string, handler: (data: unknown) => void) => void
  close: () => void
}

// Joins the game server for one Play and reports the held keys whenever they change. Without a running server the editor
// plays on its own, so a failed connection is only noted.
export function connect_to_server(engine: MainModule): ServerConnection {
  const socket = new WebSocket(server_url)
  socket.addEventListener('error', () => console.info(`No game server at ${server_url}; playing without it`))

  const waiting: string[] = []
  const event_handlers = new Map<string, ((data: unknown) => void)[]>()
  const unhandled_events: { name: string; data: unknown }[] = []
  socket.addEventListener('open', () => {
    for (const text of waiting.splice(0)) {
      socket.send(text)
    }
  })

  // Snapshots come at a lower rate than frames, so each frame slides the entities toward the latest one.
  const interpolations = new Map<string, interpolation>()
  let last = performance.now()
  const step = (now: number) => {
    const dt = (now - last) / 1000
    last = now
    for (const [id, state] of interpolations) {
      state.alpha = Math.min(state.alpha + dt / snapshot_interval, 1)
      const x = lerp(state.from[0], state.to[0], state.alpha)
      const y = lerp(state.from[1], state.to[1], state.alpha)
      const rotation = lerp_angle(state.from_rotation, state.to_rotation, state.alpha)
      engine.World.set_transform(id, x, y, rotation, state.scale[0], state.scale[1])
    }
    frame = requestAnimationFrame(step)
  }
  let frame = requestAnimationFrame(step)

  socket.addEventListener('message', (event) => {
    let message: {
      type?: string
      entities?: snapshot_entity[]
      entity?: spawned_entity_payload
      id?: string
      player_id?: number
      clip?: string
    }
    try {
      message = JSON.parse(event.data)
    } catch {
      return
    }
    
    if (message.type === 'spawn_entity' && message.entity) {
      const e = message.entity
      const existing = engine.World.find_entity(e.name)
      const world_any = engine.World as unknown as {
        create_entity_with_id?: (name: string, id: string) => string
        set_owner_id?: (id: string, owner_id: number) => void
      }
      const id = existing || (world_any.create_entity_with_id
        ? world_any.create_entity_with_id(e.name, e.id)
        : engine.World.create_entity(e.name))

      engine.World.add_component(id, 'transform')
      engine.World.add_component(id, 'networked')
      if (e.owner_id !== undefined && world_any.set_owner_id) {
        world_any.set_owner_id(id, e.owner_id)
      }
      if (e.position) {
        engine.World.set_transform(id, e.position[0], e.position[1], 0, 1, 1)
      }
      if (e.sprite) {
        engine.World.add_component(id, 'sprite')
        engine.World.set_sprite(id, e.sprite, e.order ?? 10)
      }
      if (e.animation_set) {
        engine.World.add_component(id, 'animator')
        engine.World.set_animation_set(id, e.animation_set)
      }
    } else if (message.type === 'despawn_entity' && message.id) {
      interpolations.delete(message.id)
      engine.World.set_transform(message.id, -99999, -99999, 0, 0, 0)
    } else if (message.type === 'snapshot' && message.entities) {
      for (const entity of message.entities) {
        let current = engine.World.get_transform(entity.id) as placement | null
        if (!current) {
          const world_any = engine.World as unknown as { create_entity_with_id?: (name: string, id: string) => string }
          if (world_any.create_entity_with_id) {
            world_any.create_entity_with_id('networked_entity', entity.id)
            engine.World.add_component(entity.id, 'transform')
            engine.World.add_component(entity.id, 'networked')
            current = engine.World.get_transform(entity.id) as placement | null
          }
        }
        if (entity.clip){
          engine.World.set_clip(entity.id, entity.clip)
        }
        interpolations.set(entity.id, {
          // An entity seen for the first time has nowhere to slide from, so it appears in place.
          from: current ? [current.x, current.y] : entity.position,
          to: entity.position,
          from_rotation: current ? current.rotation : entity.rotation,
          to_rotation: entity.rotation,
          scale: entity.scale ? [entity.scale[0], entity.scale[1]] : [1, 1],
          alpha: 0,
        })
      }
    } else if (message.type === 'welcome' && message.player_id) {
      engine.World.set_local_id(message.player_id)
    }
    else if (message.type === "anim_clip_changed" && message.clip && message.id) {
      engine.World.set_clip(message.id, message.clip);
    } else if (message.type === 'event' && typeof (message as { name?: unknown }).name === 'string') {
      const event_msg = message as { name: string; data?: unknown }
      const handlers = event_handlers.get(event_msg.name)
      if (handlers && handlers.length > 0) {
        for (const handler of handlers) {
          handler(event_msg.data)
        }
      } else {
        unhandled_events.push({ name: event_msg.name, data: event_msg.data })
      }
    }
  })

  function send(message: unknown): void {
    const text = JSON.stringify(message)
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(text)
    } else if (socket.readyState === WebSocket.CONNECTING) {
      waiting.push(text)
    }
  }

  const key_names = Object.keys(key_codes) as KeyName[]
  let sent_keys = ''
  const timer = setInterval(() => {
    if (socket.readyState !== WebSocket.OPEN) {
      return
    }
    const keys = key_names.filter((key) => engine.Engine.is_key_down(key_codes[key]))
    // The server starts every player with no keys held, so an empty list never needs sending first.
    if (keys.join() !== sent_keys) {
      send({ type: 'input', keys })
      sent_keys = keys.join()
    }
  }, send_interval_ms)

  return {
    send,
    on(name: string, handler: (data: unknown) => void) {
      event_handlers.set(name, [...(event_handlers.get(name) ?? []), handler])
      for (let i = 0; i < unhandled_events.length; ) {
        if (unhandled_events[i].name === name) {
          const [event] = unhandled_events.splice(i, 1)
          handler(event.data)
        } else {
          ++i
        }
      }
    },
    off(name: string, handler: (data: unknown) => void) {
      event_handlers.set(name, (event_handlers.get(name) ?? []).filter((h) => h !== handler))
    },
    close() {
      unhandled_events.length = 0
      clearInterval(timer)
      cancelAnimationFrame(frame)
      socket.close()
    },
  }
}
