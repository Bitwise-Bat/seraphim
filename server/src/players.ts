// Every connection is a player. The server keeps the keys each client last reported; server scripts read them through
// players().

export type Player = {
  readonly id: number
  readonly input: { is_down: (key: string) => boolean }
}

function player(id: number, keys: Set<string>): Player {
  return { id, input: { is_down: (key) => keys.has(key) } }
}

export function create_players() {
  const held_keys = new Map<number, Set<string>>()

  return {
    add(id: number): void {
      held_keys.set(id, new Set())
    },

    remove(id: number): void {
      held_keys.delete(id)
    },

    // Clients are not trusted, so anything but a well-formed input message is ignored.
    receive(id: number, message: unknown): void {
      const { type, keys } = message as { type?: unknown; keys?: unknown }
      if (type !== 'input' || !Array.isArray(keys) || !keys.every((key) => typeof key === 'string')) {
        return
      }
      if (held_keys.has(id)) {
        held_keys.set(id, new Set(keys))
      }
    },

    get(id: number): Player | undefined {
      const keys = held_keys.get(id)
      return keys ? player(id, keys) : undefined
    },

    list(): Player[] {
      return [...held_keys].map(([id, keys]) => player(id, keys))
    },
  }
}
