import create_seraphim, { type MainModule } from 'seraphim/seraphim.js'
import wasm_url from 'seraphim/seraphim.wasm?url'

let engine: Promise<MainModule> | undefined

// The wasm runtime is a page-wide singleton, so repeated mounts must share one instance.
export function load_engine(canvas: HTMLCanvasElement): Promise<MainModule> {
  engine ??= create_seraphim({ canvas, locateFile: () => wasm_url })
  return engine
}
