import type { MainModule } from '../build/web-debug/seraphim.js'

// The part of the 'seraphim' module that works wherever a world runs: in the editor and on the server. Each host adds
// its own capabilities on top, such as the editor's camera and input.

export type World = MainModule['World']

export type Vec2 = [number, number]

type EngineTransform = { x: number; y: number; rotation: number; scale_x: number; scale_y: number }

const identity_transform: EngineTransform = { x: 0, y: 0, rotation: 0, scale_x: 1, scale_y: 1 }

// The script whose hook is running, as a path inside scripts/. The host sets it around every hook call, so free
// functions such as log() can tell which script called them.
export const running = { script: '' }

export function create_world_api(world: World, tick_seconds: number) {
  function read_transform(id: string): EngineTransform {
    return (world.get_transform(id) as EngineTransform | null) ?? identity_transform
  }

  function write_transform(id: string, { x, y, rotation, scale_x, scale_y }: EngineTransform): void {
    world.set_transform(id, x, y, rotation, scale_x, scale_y)
  }

  class Animator {
    private readonly id: string

    constructor(id: string) {
      this.id = id
    }

    get clip(): string {
      return world.get_clip(this.id) ?? ''
    }

    set clip(clip: string) {
      world.set_clip(this.id, clip)
    }
  }

  class Body {
    private readonly id: string

    constructor(id: string) {
      this.id = id
    }

    get velocity(): Vec2 {
      const v = world.get_velocity(this.id)
      return v ? [v.x, v.y] : [0, 0]
    }

    set velocity([x, y]: Vec2) {
      world.set_velocity(this.id, x, y)
    }
  }

  class Tilemap {
    private readonly id: string

    constructor(id: string) {
      this.id = id
    }

    find_path([sx, sy]: Vec2, [ex, ey]: Vec2, blocking_layer: number): Vec2[] | undefined {
      const path = world.find_path(this.id, blocking_layer, sx, sy, ex, ey) as { x: number; y: number }[] | null
      return path?.map(({ x, y }): Vec2 => [x, y])
    }

    // The engine answers with an { x, y } object, but scripts pass cells straight back into find_path as Vec2.
    get_cell_at_coord(x: number, y: number): Vec2 | undefined {
      const cell = world.get_cell_at_coord(this.id, x, y) as { x: number; y: number } | null
      return cell ? [cell.x, cell.y] : undefined
    }

    get_cell_center([x, y]: Vec2): Vec2 | undefined {
      const center = world.get_cell_center(this.id, x, y) as { x: number; y: number } | null
      return center ? [center.x, center.y] : undefined
    }
  }

  class Entity {
    readonly id: string
    readonly name: string
    #body: Body | undefined | null
    #animator: Animator | undefined | null
    #tilemap: Tilemap | undefined | null

    constructor(id: string, name: string) {
      this.id = id
      this.name = name
    }

    get body(): Body | undefined {
      this.#body ??= world.has_body(this.id) ? new Body(this.id) : null
      return this.#body ?? undefined
    }

    get animator(): Animator | undefined {
      this.#animator ??= world.has_animator(this.id) ? new Animator(this.id) : null
      return this.#animator ?? undefined
    }

    get tilemap(): Tilemap | undefined {
      this.#tilemap ??= world.has_tilemap(this.id) ? new Tilemap(this.id) : null
      return this.#tilemap ?? undefined
    }

    get position(): Vec2 {
      const { x, y } = read_transform(this.id)
      return [x, y]
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

  function log(...values: unknown[]): void {
    console.log(...values)
  }

  // Ticks have a fixed length, so delta never changes; scripts still use it rather than assuming 60 Hz.
  const time = {
    delta: tick_seconds,
    // Ticks completed since the simulation started: 0 in on_start and in the first on_tick.
    tick: 0,
  }

  function find_entity(name: string): Entity | undefined {
    const id = world.find_entity(name)
    return id ? new Entity(id, name) : undefined
  }

  return { Entity, Script, log, time, find_entity }
}

export type WorldApi = ReturnType<typeof create_world_api>
