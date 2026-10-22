import type { MainModule } from 'seraphim/seraphim.js'
import { create } from 'zustand'

type CameraStore = {
  position: { x: number; y: number }
  view_height: number
  // Hands the camera to the engine, which shows what this store holds from then on.
  attach: (engine: MainModule) => void
  set_camera: (position: { x: number; y: number }, view_height: number) => void
}

// Only the editor moves its camera, so the store is the source of truth and the engine is just told about changes.
// Starts where the engine's camera2d does.
export const useCameraStore = create<CameraStore>()((set, get) => {
  let engine: MainModule | undefined

  function push(): void {
    const { position, view_height } = get()
    engine?.Engine.set_camera(position.x, position.y, view_height)
  }

  return {
    position: { x: 0, y: 0 },
    view_height: 10,

    attach(next_engine) {
      engine = next_engine
      push()
    },

    set_camera(position, view_height) {
      set({ position, view_height })
      push()
    },
  }
})
