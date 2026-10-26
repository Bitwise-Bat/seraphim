import type { Player } from './players.js'

export type EventHandler = (player: Player, data: unknown) => void

type QueuedEvent = { player_id: number; name: string; data: unknown }

// Events that clients emit. They arrive between ticks, so they wait in a queue until the next tick hands them to the
// handlers that server scripts registered with server.on.
export function create_events() {
  const handlers = new Map<string, EventHandler[]>()
  let queue: QueuedEvent[] = []

  return {
    on(name: string, handler: EventHandler): void {
      handlers.set(name, [...(handlers.get(name) ?? []), handler])
    },

    off(name: string, handler: EventHandler): void {
      handlers.set(name, (handlers.get(name) ?? []).filter((registered) => registered !== handler))
    },

    emit(name: string, player: Player, data: unknown): void {
      queue.push({ player_id: player.id, name, data })
    },

    // Clients are not trusted, so anything but a well-formed event message is ignored.
    receive(player_id: number, message: unknown): void {
      const { type, name, data } = message as { type?: unknown; name?: unknown; data?: unknown }
      if (type === 'event' && typeof name === 'string') {
        queue.push({ player_id, name, data })
      }
    },

    // Events of players who left before the tick are dropped. A handler that throws only loses its own event.
    dispatch(find_player: (id: number) => Player | undefined): void {
      const due = queue
      queue = []
      for (const { player_id, name, data } of due) {
        const player = find_player(player_id)
        if (!player) {
          continue
        }
        for (const handler of handlers.get(name) ?? []) {
          try {
            handler(player, data)
          } catch (error) {
            console.error(`The handler of the '${name}' event failed`, error)
          }
        }
      }
    },
  }
}
