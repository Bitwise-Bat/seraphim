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
  export abstract class Script {
    // Runs once when Play starts, before the first tick.
    on_start?(): void
    // Runs on every fixed 60 Hz tick, before physics.
    on_tick?(): void
    // Runs once when Play stops.
    on_stop?(): void
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
