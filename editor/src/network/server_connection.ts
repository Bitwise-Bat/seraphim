import type { MainModule } from 'seraphim/seraphim.js'
import { key_codes, type KeyName } from '../scripting/keys'

const server_url = 'ws://localhost:9001'
const send_interval_ms = 1000 / 60

export type ServerConnection = {
  close: () => void
}

// Joins the game server for one Play and reports the held keys whenever they change. Without a running server the editor
// plays on its own, so a failed connection is only noted.
export function connect_to_server(engine: MainModule): ServerConnection {
  const socket = new WebSocket(server_url)
  socket.addEventListener('error', () => console.info(`No game server at ${server_url}; playing without it`))

  const key_names = Object.keys(key_codes) as KeyName[]
  let sent = ''
  const timer = setInterval(() => {
    if (socket.readyState !== WebSocket.OPEN) {
      return
    }
    const keys = key_names.filter((key) => engine.Engine.is_key_down(key_codes[key]))
    const message = JSON.stringify({ type: 'input', keys })
    if (message !== sent) {
      socket.send(message)
      sent = message
    }
  }, send_interval_ms)

  return {
    close() {
      clearInterval(timer)
      socket.close()
    },
  }
}
