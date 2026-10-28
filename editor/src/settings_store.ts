import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type DockTab = 'assets' | 'console'

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

  // Layout & Docking
  dock_tab: DockTab
  dock_height: number
  scene_panel_width: number
  inspector_width: number
  asset_tree_width: number
}

type BooleanSettingKey = {
  [K in keyof EditorSettings]: EditorSettings[K] extends boolean ? K : never
}[keyof EditorSettings]

type ValueOrUpdater<T> = T | ((current: T) => T)

type SettingsStore = EditorSettings & {
  set_setting: <K extends keyof EditorSettings>(key: K, value: ValueOrUpdater<EditorSettings[K]>) => void
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

  dock_tab: 'assets',
  dock_height: 220,
  scene_panel_width: 220,
  inspector_width: 280,
  asset_tree_width: 192,
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...default_settings,

      set_setting(key, value) {
        set((state) => {
          const current = state[key]
          const next = typeof value === 'function'
            ? (value as (c: EditorSettings[typeof key]) => EditorSettings[typeof key])(current)
            : value
          return { [key]: next } as unknown as Partial<SettingsStore>
        })
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
      merge: (persisted_state, current_state) => {
        const merged = { ...current_state, ...(persisted_state as Partial<EditorSettings>) }
        if (typeof merged.dock_height !== 'number' || !Number.isFinite(merged.dock_height) || merged.dock_height <= 0) {
          merged.dock_height = default_settings.dock_height
        }
        if (typeof merged.scene_panel_width !== 'number' || !Number.isFinite(merged.scene_panel_width) || merged.scene_panel_width <= 0) {
          merged.scene_panel_width = default_settings.scene_panel_width
        }
        if (typeof merged.inspector_width !== 'number' || !Number.isFinite(merged.inspector_width) || merged.inspector_width <= 0) {
          merged.inspector_width = default_settings.inspector_width
        }
        if (typeof merged.asset_tree_width !== 'number' || !Number.isFinite(merged.asset_tree_width) || merged.asset_tree_width <= 0) {
          merged.asset_tree_width = default_settings.asset_tree_width
        }
        return merged
      },
    },
  ),
)
