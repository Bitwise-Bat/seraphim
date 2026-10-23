import type { MainModule } from 'seraphim/seraphim.js'
import { key_codes, type KeyName, mouse_codes, type MouseName } from './keys'

// Everything exported from the module that scripts import as 'seraphim'. Scripts reach the engine only through this, so
// adding a capability means adding it here and declaring it in script_types (project/scripts.ts).

export type Vec2 = [number, number]

type EngineTransform = { x: number; y: number; rotation: number; scale_x: number; scale_y: number }

const identity_transform: EngineTransform = { x: 0, y: 0, rotation: 0, scale_x: 1, scale_y: 1 }

// The script whose hook is running, as a path inside scripts/. The host sets it around every hook call, so free
// functions such as log() can tell which script called them.
export const running = { script: '' }

export function create_api(engine: MainModule) {
  const api = engine.Engine

  function read_transform(id: string): EngineTransform {
    return (api.get_transform(id) as EngineTransform | null) ?? identity_transform
  }

  function write_transform(id: string, { x, y, rotation, scale_x, scale_y }: EngineTransform): void {
    api.set_transform(id, x, y, rotation, scale_x, scale_y)
  }

  class Animator {
    private readonly id: string

    constructor(id: string) {
      this.id = id
    }

    get clip(): string {
      return api.get_clip(this.id) ?? ''
    }

    set clip(clip: string) {
      api.set_clip(this.id, clip)
    }
  }

  class Body {
    private readonly id: string

    constructor(id: string) {
      this.id = id
    }

    get velocity(): Vec2 {
      const v = api.get_velocity(this.id)
      return v ? [v.x, v.y] : [0, 0]
    }

    set velocity([x, y]: Vec2) {
      api.set_velocity(this.id, x, y)
    }
  }

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

  class Tilemap {
    private readonly id: string

    constructor(id: string) {
      this.id = id
    }

    find_path([sx, sy]: Vec2, [ex, ey]: Vec2, blocking_layer: number): Vec2[] | undefined {
      const path = api.find_path(this.id, blocking_layer, sx, sy, ex, ey) as { x: number; y: number }[] | null
      return path?.map(({ x, y }): Vec2 => [x, y])
    }

    // The engine answers with an { x, y } object, but scripts pass cells straight back into find_path as Vec2.
    get_cell_at_coord(x: number, y: number): Vec2 | undefined {
      const cell = api.get_cell_at_coord(this.id, x, y) as { x: number; y: number } | null
      return cell ? [cell.x, cell.y] : undefined
    }

    get_cell_center([x, y]: Vec2): Vec2 | undefined {
      const center = api.get_cell_center(this.id, x, y) as { x: number; y: number } | null
      return center ? [center.x, center.y] : undefined
    }
  }

  class Entity {
    readonly id: string
    readonly name: string
    #body: Body | undefined | null
    #animator: Animator | undefined | null
    #tilemap: Tilemap | undefined | null
    #audio: AudioSource | undefined | null

    constructor(id: string, name: string) {
      this.id = id
      this.name = name
    }

    get position(): Vec2 {
      const { x, y } = read_transform(this.id)
      return [x, y]
    }

    get body(): Body | undefined {
      this.#body ??= api.has_body(this.id) ? new Body(this.id) : null
      return this.#body ?? undefined
    }
    
    get animator(): Animator | undefined {
      this.#animator ??= api.has_animator(this.id) ? new Animator(this.id) : null
      return this.#animator ?? undefined
    }

    get tilemap(): Tilemap | undefined {
      this.#tilemap ??= api.has_tilemap(this.id) ? new Tilemap(this.id) : null
      return this.#tilemap ?? undefined
    }

    get audio(): AudioSource | undefined {
      this.#audio ??= api.has_audio_source(this.id) ? new AudioSource(this.id) : null
      return this.#audio ?? undefined
    }

    set position([x, y]: Vec2) {
      write_transform(this.id, { ...read_transform(this.id), x, y })
    }

    get rotation(): number {
      return read_transform(this.id).rotation
    }

    set rotation(rotation: number) {
      write_transform(this.id, { ...read_transform(this.id), rotation })
    }

    get scale(): Vec2 {
      const { scale_x, scale_y } = read_transform(this.id)
      return [scale_x, scale_y]
    }

    set scale([scale_x, scale_y]: Vec2) {
      write_transform(this.id, { ...read_transform(this.id), scale_x, scale_y })
    }
  }

  class Script {
    // Assigned by the host right after construction, so it is available from on_start on.
    entity!: Entity
  }

  // Writes a message from the running script to the browser console.
  function log(...values: unknown[]): void {
    console.log(...values);
  }

  // Ticks have a fixed length, so delta never changes; scripts still use it rather than assuming 60 Hz.
  const time = {
    delta: api.tick_seconds(),
    // Ticks completed since Play started: 0 in on_start and in the first on_tick.
    tick: 0,
  }

  // Only exists where the game is shown, unlike the entity API, which server scripts use as well.
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

  function find_entity(name: string): Entity | undefined {
    const id = api.find_entity(name)
    return id ? new Entity(id, name) : undefined
  }

  return { Entity, Script, log, input, time, camera, find_entity }
}

export type ScriptApi = ReturnType<typeof create_api>
