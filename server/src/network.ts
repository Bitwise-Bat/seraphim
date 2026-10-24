import { createRequire } from 'node:module'

// The package's ESM wrapper imports an index.js it does not ship (v20.71.0), so it is loaded as CommonJS instead.
const uWS = createRequire(import.meta.url)('uWebSockets.js') as typeof import('uWebSockets.js')

// What the server keeps for each open WebSocket. uWS hands the same object to every callback of that socket.
export type Connection = {
  id: number
}

export type NetworkEvents = {
  connected: (connection: Connection) => void
  disconnected: (connection: Connection) => void
}

// Accepts WebSocket connections on the port and reports them; it knows nothing about the game.
export function start_network(port: number, events: NetworkEvents): void {
  let next_id = 1

  uWS
    .App()
    .ws<Connection>('/*', {
      open: (socket) => {
        const connection = socket.getUserData()
        connection.id = next_id++
        events.connected(connection)
      },
      close: (socket) => {
        events.disconnected(socket.getUserData())
      },
    })
    .listen(port, (listen_socket) => {
      if (!listen_socket) {
        console.error(`Could not listen on port ${port}`)
        process.exit(1)
      }
      console.log(`Listening on ws://localhost:${port}`)
    })
}
