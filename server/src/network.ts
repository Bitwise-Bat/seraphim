import { createRequire } from 'node:module'
import type { WebSocket } from 'uWebSockets.js'

// The package's ESM wrapper imports an index.js it does not ship (v20.71.0), so it is loaded as CommonJS instead.
const uWS = createRequire(import.meta.url)('uWebSockets.js') as typeof import('uWebSockets.js')

// What the server keeps for each open WebSocket. uWS hands the same object to every callback of that socket.
export type Connection = {
  id: number
}

export type NetworkEvents = {
  connected: (connection: Connection) => void
  disconnected: (connection: Connection) => void
  // Messages that are not JSON never get here.
  received: (connection: Connection, message: unknown) => void
}

export type Network = {
  // Text for a connection that has closed is dropped.
  send: (id: number, text: string) => void
}

// Accepts WebSocket connections on the port and reports them; it knows nothing about the game.
export function start_network(port: number, events: NetworkEvents): Network {
  let next_id = 1
  const sockets = new Map<number, WebSocket<Connection>>()

  uWS
    .App()
    .ws<Connection>('/*', {
      open: (socket) => {
        const connection = socket.getUserData()
        connection.id = next_id++
        sockets.set(connection.id, socket)
        events.connected(connection)
      },
      message: (socket, data) => {
        // The data is only valid during this callback, so it is decoded right away.
        let message: unknown
        try {
          message = JSON.parse(Buffer.from(data).toString())
        } catch {
          return
        }
        events.received(socket.getUserData(), message)
      },
      close: (socket) => {
        const connection = socket.getUserData()
        // Removed first, so nothing reacting to the disconnect sends to the closed socket.
        sockets.delete(connection.id)
        events.disconnected(connection)
      },
    })
    .listen(port, (listen_socket) => {
      if (!listen_socket) {
        console.error(`Could not listen on port ${port}`)
        process.exit(1)
      }
      console.log(`Listening on ws://localhost:${port}`)
    })

  return {
    send: (id, text) => {
      sockets.get(id)?.send(text)
    },
  }
}
