import { useEffect, useState } from 'react'
import { DockSlot } from './DockSlot'
import { Inspector } from './Inspector'
import { useAssetStore, useScriptStore } from './project/asset_store'
import { useSceneStore } from './project/scene_store'
import { SceneTree } from './SceneTree'
import { Splitter } from './Splitter'
import { Viewport } from './Viewport'

const asset_panel_limits = { min: 120, max: 600 }
const side_panel_limits = { min: 160, max: 520 }

export function Workspace({ project }: { project: FileSystemDirectoryHandle }) {
  const scan_assets = useAssetStore((store) => store.scan)
  const scan_scripts = useScriptStore((store) => store.scan)
  const save = useSceneStore((store) => store.save)
  const [asset_panel_height, set_asset_panel_height] = useState(220)
  const [scene_panel_width, set_scene_panel_width] = useState(220)
  const [inspector_width, set_inspector_width] = useState(280)

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
    <div className="workspace" style={{ gridTemplateRows: `minmax(0, 1fr) auto ${asset_panel_height}px` }}>
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
          on_resize={set_scene_panel_width}
        />
        <Viewport project={project} />
        <Splitter
          label="Resize inspector"
          orientation="vertical"
          panel="after"
          size={inspector_width}
          min={side_panel_limits.min}
          max={side_panel_limits.max}
          on_resize={set_inspector_width}
        />
        <Inspector />
      </div>
      <Splitter
        label="Resize dock panel"
        orientation="horizontal"
        panel="after"
        size={asset_panel_height}
        min={asset_panel_limits.min}
        max={asset_panel_limits.max}
        on_resize={set_asset_panel_height}
      />
      <DockSlot />
    </div>
  )
}
