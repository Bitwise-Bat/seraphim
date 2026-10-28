import { useEffect } from 'react'
import { DockSlot } from './DockSlot'
import { Inspector } from './Inspector'
import { useAssetStore, useScriptStore } from './project/asset_store'
import { useSceneStore } from './project/scene_store'
import { SceneTree } from './SceneTree'
import { useSettingsStore } from './settings_store'
import { Splitter } from './Splitter'
import { Viewport } from './Viewport'

const asset_panel_limits = { min: 120, max: 600 }
const side_panel_limits = { min: 160, max: 520 }

export function Workspace({ project }: { project: FileSystemDirectoryHandle }) {
  const scan_assets = useAssetStore((store) => store.scan)
  const scan_scripts = useScriptStore((store) => store.scan)
  const save = useSceneStore((store) => store.save)
  const dock_height = useSettingsStore((store) => store.dock_height)
  const scene_panel_width = useSettingsStore((store) => store.scene_panel_width)
  const inspector_width = useSettingsStore((store) => store.inspector_width)
  const set_setting = useSettingsStore((store) => store.set_setting)

  useEffect(() => {
    void scan_assets(project)
    void scan_scripts(project)
  }, [project, scan_assets, scan_scripts])

  useEffect(() => {
    function on_key_down(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        // Stops the browser from offering to save the page.
        event.preventDefault()
        void save()
      }
    }
    function on_before_unload(event: BeforeUnloadEvent) {
      if (useSceneStore.getState().dirty) {
        event.preventDefault()
      }
    }
    window.addEventListener('keydown', on_key_down)
    window.addEventListener('beforeunload', on_before_unload)
    return () => {
      window.removeEventListener('keydown', on_key_down)
      window.removeEventListener('beforeunload', on_before_unload)
    }
  }, [save])

  return (
    <div className="workspace" style={{ gridTemplateRows: `minmax(0, 1fr) auto ${dock_height}px` }}>
      <div
        className="workspace-main"
        style={{ gridTemplateColumns: `${scene_panel_width}px auto minmax(0, 1fr) auto ${inspector_width}px` }}
      >
        <SceneTree />
        <Splitter
          label="Resize scene panel"
          orientation="vertical"
          panel="before"
          size={scene_panel_width}
          min={side_panel_limits.min}
          max={side_panel_limits.max}
          on_resize={(width) => set_setting('scene_panel_width', width)}
        />
        <Viewport project={project} />
        <Splitter
          label="Resize inspector"
          orientation="vertical"
          panel="after"
          size={inspector_width}
          min={side_panel_limits.min}
          max={side_panel_limits.max}
          on_resize={(width) => set_setting('inspector_width', width)}
        />
        <Inspector />
      </div>
      <Splitter
        label="Resize dock panel"
        orientation="horizontal"
        panel="after"
        size={dock_height}
        min={asset_panel_limits.min}
        max={asset_panel_limits.max}
        on_resize={(height) => set_setting('dock_height', height)}
      />
      <DockSlot />
    </div>
  )
}
