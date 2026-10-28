import { key_codes, mouse_codes } from '../scripting/keys'

// What "New script" writes: the smallest script the engine will run, with the hooks a script usually fills in first.
export const script_template = {
  name: 'NewScript.ts',
  contents: `import { Script } from 'seraphim'

export default class extends Script {
  on_start(): void {}

  on_tick(): void {}
}
`,
}

// Declares the engine API for editors such as VS Code. It is regenerated on every open, so it always matches the
// editor version that runs the scripts.
export const script_types = {
  folder: 'types',
  name: 'seraphim.d.ts',
  contents: `declare module 'seraphim' {
  // Read-only, so that changing one element of a copy, which would not move anything, is a type error.
  export type Vec2 = readonly [number, number]

  export type Key = ${Object.keys(key_codes)
      .map((key) => `'${key}'`)
      .join(' | ')}

  export type MouseButton = ${Object.keys(mouse_codes)
      .map((button) => `'${button}'`)
      .join(' | ')}

  export class Body {
    private readonly id: string
    get velocity(): Vec2
    set velocity([x, y]: Vec2)
    set fixed_rotation(enabled: boolean)
    get fixed_rotation(): boolean
    // Box2D collision filtering: [0] = category_bits (what layer this is), [1] = mask_bits (what layers it collides with)
    set layers(layers: [number, number])
  }

  export class Animator {
    private readonly id: string
    // Name of the playing clip. Assigning another one starts it from its first frame.
    clip: string
    set: string
  }

  export class AudioSource {
    private readonly id: string
    // True from play() until the sound ends or stop() is called, including while the sound is still loading.
    readonly playing: boolean
    // 1 plays the sound as recorded; negative values count as 0.
    volume: number
    // Starts the sound from the beginning, even if it is already playing.
    play(): void
    stop(): void
  }

  export class Tilemap {
    private readonly id: string
    // Cell coordinates in, waypoints out, without the start cell; undefined when no path exists.
    find_path(start: Vec2, end: Vec2, blocking_layer: number): Vec2[] | undefined
    // The cell under a world position; undefined outside the map.
    get_cell_at_coord(x: number, y: number): Vec2 | undefined
    // World position of the centre of a cell; undefined outside the map.
    get_cell_center(cell: Vec2): Vec2 | undefined
  }
  
  class Sprite {
    private readonly id: string
    set_sprite(sprite: string, order?: number) : void;
  }

  export class Entity {
    readonly id: string
    readonly name: string
    #body: Body | undefined | null
    #animator: Animator | undefined | null
    #tilemap: Tilemap | undefined | null
    #audio: AudioSource | undefined | null
    #sprite: Sprite | undefined | null
    // Each read returns a copy, so assign a whole new value to move the entity: entity.position = [x, y].
    position: Vec2
    // Counter-clockwise, in radians.
    rotation: number
    scale: Vec2
    get body(): Body | undefined
    get animator(): Animator | undefined
    get tilemap(): Tilemap | undefined
    get audio(): AudioSource | undefined
    get sprite(): Sprite | undefined
    
    is_local(): boolean
    add_component(component_name: string): void
    add_script(script_id: string) : void
  }

  export abstract class Script {
    // The entity this script is attached to; available from on_start on.
    readonly entity: Entity
    // Runs once when Play starts, before the first tick and before physics creates its bodies.
    on_start?(): void
    // Runs on every fixed 60 Hz tick, before physics.
    on_tick?(): void
    // Runs once when Play stops.
    on_stop?(): void
  }

  // Writes to the browser console, labelled with the calling script.
  export function log(...values: unknown[]): void

  // Keys follow the physical layout. Presses and releases are seen by the first tick after they happen.
  export const input: {
    is_down(key: Key): boolean
    was_pressed(key: Key): boolean
    was_released(key: Key): boolean
    is_mouse_down(button: MouseButton): boolean
    was_mouse_pressed(button: MouseButton): boolean
    was_mouse_released(button: MouseButton): boolean
    // The point under the cursor in world coordinates, so it can be compared with entity positions directly.
    readonly mouse_position: Vec2
  }

  // Only works in the browser; on the game server there is no camera.
  export const camera: {
    // Each read returns a copy, so assign a whole new value to move it: camera.position = [x, y].
    position: Vec2
    screen_to_world(x: number, y: number): { x: number; y: number }
    set view_height(view_height: number)
    get view_height(): number
  }

  export const time: {
    // Seconds per tick. Ticks have a fixed length, so this never changes during Play.
    readonly delta: number
    // Ticks completed since Play started: 0 in on_start and in the first on_tick.
    readonly tick: number
  }

  // Returns the first entity with the name.
  export function find_entity(name: string): Entity | undefined
  export function create_entity(name: string): Entity

  export type Player = {
    // Stays the same while the player is connected.
    readonly id: number
    // The keys the player's client holds down, as it last reported them.
    readonly input: { is_down(key: Key): boolean }
  }

  // Only works on the game server: the players connected right now, in the order they joined.
  export function players(): Player[]

  export type EventHandler = (player: Player, data: unknown) => void

  export type SpawnOptions = {
    name: string
    owner_id?: number
    position?: [number, number]
    sprite?: string
    order?: number
    animation_set?: string
  }

  // Only works on the game server.
  export const server: {
    // The handler runs at the start of the tick after a client emits the event, before on_tick.
    on(name: string, handler: EventHandler): void
    off(name: string, handler: EventHandler): void
    spawn(options: SpawnOptions): string
    despawn(id: string): void
    send(player_id: number, name: string, data?: unknown): void
    broadcast(name: string, data?: unknown): void
    set_clip(id: string, clip: string): void
  }

  // Only works in the browser.
  export const net: {
    // Sends an event to the game server, where server.on handlers receive it. The data travels as JSON.
    send(name: string, data?: unknown): void
    on(name: string, cb: (data: unknown) => void): void
    off(name: string, cb: (data: unknown) => void): void
  }

  export type UITag = {
    div: unknown
    span: unknown
    button: unknown
    input: unknown
    img: unknown
    p: unknown
  }
  
  export class ui<K extends keyof UITag = keyof UITag> {
    constructor(tag: K, name: string)
    set_style(key: string, value: string): void
    set text(text: string)
    get text(): string
    set img(src: string)
    get img(): string
    public remove(): void
  }
}
`,
}

// Scripts also run on the game server, so the browser's DOM types are left out to keep them from relying on it.
export const script_tsconfig = {
  name: 'tsconfig.json',
  contents: `${JSON.stringify(
    {
      compilerOptions: {
        target: 'es2023',
        lib: ['ES2023'],
        types: [],
        module: 'esnext',
        moduleResolution: 'bundler',
        strict: true,
        noEmit: true,
      },
      include: ['scripts', `.seraphim/${script_types.folder}`],
    },
    null,
    2,
  )}\n`,
}
