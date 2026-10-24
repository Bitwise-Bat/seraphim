import type { MainModule } from 'seraphim/seraphim.js'
import { key_codes, type KeyName } from '../scripting/keys'

const server_url = 'ws://localhost:9001'
const send_interval_ms = 1000 / 60

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
      socket.close()
    },
  }
}
