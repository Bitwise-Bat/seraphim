import create_seraphim, { type MainModule } from 'seraphim/seraphim.js'
import wasm_url from 'seraphim/seraphim.wasm?url'

let engine: Promise<MainModule> | undefined
let shared_canvas: HTMLCanvasElement | undefined

// SDL and WebGPU bind to the first #seraphim-canvas element, so remounting the viewport reuses that DOM node.
export function get_engine_canvas(): HTMLCanvasElement {
  if (!shared_canvas) {
    shared_canvas = document.createElement('canvas')
    shared_canvas.id = 'seraphim-canvas'
    shared_canvas.tabIndex = 0
    shared_canvas.className = 'viewport-canvas'
  }
  return shared_canvas
}

// The wasm runtime is a page-wide singleton, so repeated mounts must share one instance.
export function load_engine(canvas: HTMLCanvasElement): Promise<MainModule> {
  engine ??= create_seraphim({ canvas, locateFile: () => wasm_url })
  return engine
}
