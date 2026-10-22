import { useCallback, useState, type DragEvent, type MouseEvent, type ReactNode } from 'react'
import { AssetThumbnail } from './AssetThumbnail'
import { ContextMenu } from './ContextMenu'
import { find_folder, type AssetEntry } from './project/assets'
import { useAssetStore } from './project/asset_store'
import { RenameInput } from './RenameInput'

function dropped_files(event: DragEvent): File[] {
  // Dropped folders also arrive as items; only plain files are imported. Items without an entry are files handed over
  // by script rather than from the file system.
  return [...event.dataTransfer.items]
    .filter((item) => item.kind === 'file' && (item.webkitGetAsEntry()?.isFile ?? true))
    .map((item) => item.getAsFile())
    .filter((file) => file !== null)
}

type AssetTileProps = {
  entry: AssetEntry
  thumbnail: ReactNode
  title?: string
  renaming: boolean
  on_open?: () => void
  on_context_menu: (event: MouseEvent) => void
  on_rename: (new_name: string) => void
  on_rename_end: () => void
}

function AssetTile({ entry, thumbnail, title, renaming, on_open, on_context_menu, on_rename, on_rename_end }: AssetTileProps) {
  if (renaming) {
    return (
      <div className="asset-tile">
        {thumbnail}
        <RenameInput
          name={entry.name}
          on_commit={(new_name) => {
            on_rename_end()
            on_rename(new_name)
          }}
          on_cancel={on_rename_end}
        />
      </div>
    )
  }
  return (
    <button type="button" className="asset-tile" title={title} onClick={on_open} onContextMenu={on_context_menu}>
      {thumbnail}
      <span className="asset-name">{entry.name}</span>
    </button>
  )
}

export function AssetBrowser() {
  const root = useAssetStore((store) => store.root)
  const current_path = useAssetStore((store) => store.current_path)
  const error = useAssetStore((store) => store.error)
  const navigate = useAssetStore((store) => store.navigate)
  const import_into_current = useAssetStore((store) => store.import_into_current)
  const rename = useAssetStore((store) => store.rename)
  const remove = useAssetStore((store) => store.remove)
  const [dragging, set_dragging] = useState(false)
  const [menu, set_menu] = useState<{ x: number; y: number; entry: AssetEntry; trigger: HTMLElement }>()
  const [renaming, set_renaming] = useState<string>()
  // Returning focus to the tile lets keyboard users continue where they opened the menu.
  const close_menu = useCallback(() => {
    menu?.trigger.focus()
    set_menu(undefined)
  }, [menu])

  const folder = root && find_folder(root, current_path)
  const segments = current_path ? current_path.split('/') : []

  function on_drag_over(event: DragEvent) {
    if (event.dataTransfer.types.includes('Files')) {
      event.preventDefault()
      set_dragging(true)
    }
  }

  function on_drop(event: DragEvent) {
    event.preventDefault()
    set_dragging(false)
    void import_into_current(dropped_files(event))
  }

  function open_menu(entry: AssetEntry) {
    return (event: MouseEvent) => {
      event.preventDefault()
      set_menu({ x: event.clientX, y: event.clientY, entry, trigger: event.currentTarget as HTMLElement })
    }
  }

  function confirm_delete(entry: AssetEntry) {
    const what = entry.kind === 'directory' ? `the folder "${entry.name}" and everything in it` : `"${entry.name}"`
    if (window.confirm(`Delete ${what}? This cannot be undone.`)) {
      void remove(entry)
    }
  }

  function tile_props(entry: AssetEntry) {
    return {
      entry,
      renaming: renaming === entry.name,
      on_context_menu: open_menu(entry),
      on_rename: (new_name: string) => void rename(entry, new_name),
      on_rename_end: () => set_renaming(undefined),
    }
  }

  return (
    <section
      className={`asset-browser${dragging ? ' asset-browser-dragging' : ''}`}
      aria-label="Assets"
      onDragOver={on_drag_over}
      onDragLeave={(event) => {
        // Moving between child elements also fires dragleave; only leaving the panel itself ends the drag.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          set_dragging(false)
        }
      }}
      onDrop={on_drop}
    >
      <nav className="asset-path" aria-label="Asset folder">
        <button type="button" onClick={() => navigate('')}>
          assets
        </button>
        {segments.map((segment, index) => (
          <span key={index}>
            {' / '}
            <button type="button" onClick={() => navigate(segments.slice(0, index + 1).join('/'))}>
              {segment}
            </button>
          </span>
        ))}
      </nav>
      {error && <p role="alert">{error}</p>}
      {folder && folder.folders.length + folder.files.length === 0 && (
        <p className="asset-hint">Drop images here to add them to the project.</p>
      )}
      <ul className="asset-grid">
        {folder?.folders.map((child) => (
          <li key={child.path}>
            <AssetTile
              {...tile_props({ kind: 'directory', name: child.name })}
              thumbnail={<span className="asset-thumbnail asset-thumbnail-label">folder</span>}
              on_open={() => navigate(child.path)}
            />
          </li>
        ))}
        {folder?.files.map((file) => (
          <li key={file.id}>
            <AssetTile
              {...tile_props({ kind: 'file', name: file.name })}
              thumbnail={<AssetThumbnail file={file} />}
              title={file.path}
            />
          </li>
        ))}
      </ul>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={[
            { label: 'Rename', action: () => set_renaming(menu.entry.name) },
            { label: 'Delete', action: () => confirm_delete(menu.entry) },
          ]}
          on_close={close_menu}
        />
      )}
    </section>
  )
}
