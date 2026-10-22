import { useState, type DragEvent } from 'react'
import { find_folder, type AssetEntry } from './project/assets'
import { useAssetStore } from './project/asset_store'

// A private type keeps asset drags apart from files dragged in from the operating system.
const asset_drag_type = 'application/x-seraphim-asset'

type DraggedAsset = {
  source_path: string
  entry: AssetEntry
}

export function start_asset_drag(event: DragEvent, asset: DraggedAsset): void {
  event.dataTransfer.setData(asset_drag_type, JSON.stringify(asset))
  // Dropping on a folder moves the asset; dropping on a field that references assets links to it.
  event.dataTransfer.effectAllowed = 'linkMove'
}

// Drop handlers for fields that reference a file asset, such as a sprite's texture. Folders are not accepted.
export function useAssetFileDrop(on_drop: (id: string) => void) {
  const root = useAssetStore((store) => store.root)
  const [active, set_active] = useState(false)

  return {
    active,
    handlers: {
      onDragOver(event: DragEvent) {
        if (event.dataTransfer.types.includes(asset_drag_type)) {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'link'
          set_active(true)
        }
      },
      onDragLeave() {
        set_active(false)
      },
      onDrop(event: DragEvent) {
        const data = event.dataTransfer.getData(asset_drag_type)
        if (!data) {
          return
        }
        event.preventDefault()
        set_active(false)
        const { source_path, entry } = JSON.parse(data) as DraggedAsset
        const file =
          entry.kind === 'file' && root
            ? find_folder(root, source_path)?.files.find((candidate) => candidate.name === entry.name)
            : undefined
        if (file) {
          on_drop(file.id)
        }
      },
    },
  }
}

// Drop handlers for anything that stands for a folder: folder tiles, tree nodes and path segments.
export function useFolderDrop(target_path: string) {
  const move = useAssetStore((store) => store.move)
  const [active, set_active] = useState(false)

  return {
    active,
    handlers: {
      onDragOver(event: DragEvent) {
        if (event.dataTransfer.types.includes(asset_drag_type)) {
          event.preventDefault()
          event.stopPropagation()
          event.dataTransfer.dropEffect = 'move'
          set_active(true)
        }
      },
      onDragLeave() {
        set_active(false)
      },
      onDrop(event: DragEvent) {
        const data = event.dataTransfer.getData(asset_drag_type)
        if (!data) {
          return
        }
        event.preventDefault()
        event.stopPropagation()
        set_active(false)
        const { source_path, entry } = JSON.parse(data) as DraggedAsset
        void move(source_path, entry, target_path)
      },
    },
  }
}
