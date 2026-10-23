import { key_codes } from '../scripting/keys'

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

  export class Body {
    private readonly id: string
    get velocity(): Vec2
    set velocity([x, y]: Vec2)
  }

  export class Entity {
    readonly id: string
    readonly name: string
    #body: Body | undefined | null
    // Each read returns a copy, so assign a whole new value to move the entity: entity.position = [x, y].
    position: Vec2
    // Counter-clockwise, in radians.
    rotation: number
    scale: Vec2
    get body(): Body | undefined
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
  }

  export const time: {
    // Seconds per tick. Ticks have a fixed length, so this never changes during Play.
    readonly delta: number
    // Ticks completed since Play started: 0 in on_start and in the first on_tick.
    readonly tick: number
  }

  // Returns the first entity with the name.
  export function find_entity(name: string): Entity | undefined
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
