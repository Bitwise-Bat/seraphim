import { useEffect, useState } from 'react'
import { AssetBrowser } from './AssetBrowser'
import { use_asset_store } from './project/asset_store'
import { Splitter } from './Splitter'
import { Viewport } from './Viewport'

const asset_panel_limits = { min: 120, max: 600 }

export function Workspace({ project }: { project: FileSystemDirectoryHandle }) {
  const scan = use_asset_store((store) => store.scan)
  const [asset_panel_height, set_asset_panel_height] = useState(220)

  useEffect(() => {
    void scan(project)
  }, [project, scan])

  return (
    <div className="workspace" style={{ gridTemplateRows: `minmax(0, 1fr) auto ${asset_panel_height}px` }}>
      <Viewport />
      <Splitter
        label="Resize asset panel"
        size={asset_panel_height}
        min={asset_panel_limits.min}
        max={asset_panel_limits.max}
        on_resize={set_asset_panel_height}
      />
      <AssetBrowser />
    </div>
  )
}
