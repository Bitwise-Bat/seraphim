import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type EditorSettings = {
  // Grid and snapping
  show_grid: boolean
  snap_to_grid: boolean
  grid_size: number

  // Viewport overlays
  show_colliders: boolean
  show_fps: boolean
  show_frame_time: boolean

  // Editor behaviors
  auto_save: boolean
}

type BooleanSettingKey = {
  [K in keyof EditorSettings]: EditorSettings[K] extends boolean ? K : never
}[keyof EditorSettings]

type SettingsStore = EditorSettings & {
  set_setting: <K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) => void
  toggle_setting: (key: BooleanSettingKey) => void
  reset_defaults: () => void
}

const default_settings: EditorSettings = {
  show_grid: true,
  snap_to_grid: false,
  grid_size: 1,

  show_colliders: true,
  show_fps: true,
  show_frame_time: false,

  auto_save: false,
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...default_settings,

      set_setting(key, value) {
        set({ [key]: value } as Partial<SettingsStore>)
      },

      toggle_setting(key) {
        set((state) => ({ [key]: !state[key] } as unknown as Partial<SettingsStore>))
      },

      reset_defaults() {
        set(default_settings)
      },
    }),
    {
      name: 'seraphim-editor-settings',
    },
  ),
)
