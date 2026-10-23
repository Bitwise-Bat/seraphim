import type { MainModule } from 'seraphim/seraphim.js'
import { key_codes, type KeyName } from './keys'

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
    private readonly entity : string;
    
    constructor(entity: string) {
      this.entity = entity;
    }
    
    get clip() : string | undefined {
      return api.get_clip(this.entity);
    }
    
    set clip(clip: string){
      api.set_clip(this.entity, clip);
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

  class Entity {
    readonly id: string
    readonly name: string
    #body: Body | undefined | null
    #animator: Animator | undefined | null

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
      this.#animator ??= api.has_animator(this.id) ? new Animator(this.id) : null;
      return this.#animator ?? undefined;
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

  const input = {
    is_down: (key: KeyName): boolean => api.is_key_down(key_codes[key]),
    was_pressed: (key: KeyName): boolean => api.was_key_pressed(key_codes[key]),
    was_released: (key: KeyName): boolean => api.was_key_released(key_codes[key]),
  }

  function find_entity(name: string): Entity | undefined {
    const id = api.find_entity(name)
    return id ? new Entity(id, name) : undefined
  }

  return { Entity, Script, log, input, time, find_entity }
}

export type ScriptApi = ReturnType<typeof create_api>
