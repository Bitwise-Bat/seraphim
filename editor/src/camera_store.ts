import type { MainModule } from 'seraphim/seraphim.js'
import { create } from 'zustand'
import { useSettingsStore } from './settings_store'

type CameraStore = {
  position: { x: number; y: number }
  view_height: number
  // Hands the camera to the engine, which shows what this store holds from then on.
  attach: (engine: MainModule) => void
  set_camera: (position: { x: number; y: number }, view_height: number) => void
}

// Only the editor moves its camera, so the store is the source of truth and the engine is just told about changes.
// Starts from persisted settings, pushing them to the engine when attached.
export const useCameraStore = create<CameraStore>()((set, get) => {
  let engine: MainModule | undefined

  function push(): void {
    const { position, view_height } = get()
    engine?.Engine.set_camera(position.x, position.y, view_height)
  }

  const initial = useSettingsStore.getState()

  return {
    position: { x: initial.camera_position[0], y: initial.camera_position[1] },
    view_height: initial.camera_view_height,

    attach(next_engine) {
      engine = next_engine
      push()
    },

    set_camera(position, view_height) {
      set({ position, view_height })
      push()
      const { set_setting } = useSettingsStore.getState()
      set_setting('camera_position', [position.x, position.y])
      set_setting('camera_view_height', view_height)
    },
  }
})
