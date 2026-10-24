import type { MainModule } from 'seraphim/seraphim.js'
import type { ServerConnection } from '../network/server_connection'
import { create_world_api, type Vec2 } from '../../../runtime/world_api.ts'
import { key_codes, type KeyName, mouse_codes, type MouseName } from './keys'

// Everything exported from the module that scripts import as 'seraphim' in the editor: the shared world API plus what
// only exists where the game is shown. Adding a capability means adding it here or in runtime/world_api.ts and declaring
// it in script_types (project/scripts.ts).
export function create_api(engine: MainModule, connection: ServerConnection) {
  const api = engine.Engine
  const shared = create_world_api(engine.World, api.tick_seconds())

  class AudioSource {
    private readonly id: string

    constructor(id: string) {
      this.id = id
    }

    get playing(): boolean {
      return api.is_audio_playing(this.id)
    }

    get volume(): number {
      return api.get_audio_volume(this.id)
    }

    set volume(volume: number) {
      api.set_audio_volume(this.id, volume)
    }

    play(): void {
      api.play_audio(this.id)
    }

    stop(): void {
      api.stop_audio(this.id)
    }
  }

  class Entity extends shared.Entity {
    #audio: AudioSource | undefined | null

    get audio(): AudioSource | undefined {
      this.#audio ??= api.has_audio_source(this.id) ? new AudioSource(this.id) : null
      return this.#audio ?? undefined
    }
  }

  const camera = {
    get position(): Vec2 {
      const { x, y } = api.get_camera() as { x: number; y: number }
      return [x, y]
    },
    set position([x, y]: Vec2) {
      // A view height of -1 keeps the current zoom.
      api.set_camera(x, y, -1)
    },
    screen_to_world(x: number, y: number): { x: number; y: number } {
      return api.screen_to_world(x, y)
    },
  }

  const input = {
    is_down: (key: KeyName): boolean => api.is_key_down(key_codes[key]),
    was_pressed: (key: KeyName): boolean => api.was_key_pressed(key_codes[key]),
    was_released: (key: KeyName): boolean => api.was_key_released(key_codes[key]),
    is_mouse_down: (button: MouseName): boolean => api.is_mouse_down(mouse_codes[button]),
    was_mouse_pressed: (button: MouseName): boolean => api.was_mouse_pressed(mouse_codes[button]),
    was_mouse_released: (button: MouseName): boolean => api.was_mouse_released(mouse_codes[button]),
    get mouse_position(): Vec2 {
      const position = api.get_mouse_position() as { x: number; y: number } | null
      return position ? [position.x, position.y] : [0, 0]
    },
  }

  const net = {
    send: (name: string, data?: unknown): void => connection.send({ type: 'event', name, data }),
  }

  function find_entity(name: string): Entity | undefined {
    const id = engine.World.find_entity(name)
    return id ? new Entity(id, name) : undefined
  }

  return { ...shared, Entity, find_entity, camera, input, net }
}
