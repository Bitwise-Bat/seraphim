import type { MainModule } from 'seraphim/seraphim.js'
import { key_codes, type KeyName } from '../scripting/keys'

const server_url = 'ws://localhost:9001'
const send_interval_ms = 1000 / 60
// Matches the server, which sends a snapshot every third 60 Hz tick.
const snapshot_interval = 3 / 60

type snapshot_entity = { id: string; position: [number, number]; rotation: number }

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
  close: () => void
}

// Joins the game server for one Play and reports the held keys whenever they change. Without a running server the editor
// plays on its own, so a failed connection is only noted.
export function connect_to_server(engine: MainModule): ServerConnection {
  const socket = new WebSocket(server_url)
  socket.addEventListener('error', () => console.info(`No game server at ${server_url}; playing without it`))

  const waiting: string[] = []
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
    let message: { type?: unknown; entities?: snapshot_entity[] }
    try {
      message = JSON.parse(event.data)
    } catch {
      return
    }
    if (message.type !== 'snapshot' || !message.entities) {
      return
    }
    for (const entity of message.entities) {
      const current = engine.World.get_transform(entity.id) as placement | null
      interpolations.set(entity.id, {
        // An entity seen for the first time has nowhere to slide from, so it appears in place.
        from: current ? [current.x, current.y] : entity.position,
        to: entity.position,
        from_rotation: current ? current.rotation : entity.rotation,
        to_rotation: entity.rotation,
        scale: current ? [current.scale_x, current.scale_y] : [1, 1],
        alpha: 0,
      })
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
    close() {
      clearInterval(timer)
      cancelAnimationFrame(frame)
      socket.close()
    },
  }
}
