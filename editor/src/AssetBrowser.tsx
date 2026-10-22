import { useCallback, useState, type DragEvent, type MouseEvent, type ReactNode } from 'react'
import { start_asset_drag, useFolderDrop } from './asset_drag'
import { AssetThumbnail } from './AssetThumbnail'
import { AssetTree } from './AssetTree'
import { ContextMenu, type ContextMenuItem } from './ContextMenu'
import { find_folder, join_path, type AssetEntry } from './project/assets'
import { useAssetStore } from './project/asset_store'
import { RenameInput } from './RenameInput'
import { Splitter } from './Splitter'

const tree_width_limits = { min: 120, max: 480 }

function dropped_files(event: DragEvent): File[] {
  // Dropped folders also arrive as items; only plain files are imported. Items without an entry are files handed over
  // by script rather than from the file system.
  return [...event.dataTransfer.items]
    .filter((item) => item.kind === 'file' && (item.webkitGetAsEntry()?.isFile ?? true))
    .map((item) => item.getAsFile())
    .filter((file) => file !== null)
}

function PathSegment({ label, path }: { label: string; path: string }) {
  const navigate = useAssetStore((store) => store.navigate)
  const drop = useFolderDrop(path)
  return (
    <button
      type="button"
      className={drop.active ? 'drop-target' : undefined}
      onClick={() => navigate(path)}
      {...drop.handlers}
    >
      {label}
    </button>
  )
}

type AssetTileProps = {
  entry: AssetEntry
  path: string
  thumbnail: ReactNode
  renaming: boolean
  on_open?: () => void
  on_context_menu: (event: MouseEvent) => void
  on_rename: (new_name: string) => void
  on_rename_end: () => void
}

function AssetTile({ entry, path, thumbnail, renaming, on_open, on_context_menu, on_rename, on_rename_end }: AssetTileProps) {
  const current_path = useAssetStore((store) => store.current_path)
  const drop = useFolderDrop(path)
  // Only folders accept dropped assets.
  const drop_props = entry.kind === 'directory' ? drop.handlers : {}

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
    <button
      type="button"
      className={`asset-tile${drop.active ? ' drop-target' : ''}`}
      title={path}
      draggable
      onDragStart={(event) => start_asset_drag(event, { source_path: current_path, entry })}
      onClick={on_open}
      onContextMenu={on_context_menu}
      {...drop_props}
    >
      {thumbnail}
      <span className="asset-name">{entry.name}</span>
    </button>
  )
}

type MenuState = { x: number; y: number; items: ContextMenuItem[]; trigger: HTMLElement }

export function AssetBrowser() {
  const root = useAssetStore((store) => store.root)
  const current_path = useAssetStore((store) => store.current_path)
  const error = useAssetStore((store) => store.error)
  const navigate = useAssetStore((store) => store.navigate)
  const import_into_current = useAssetStore((store) => store.import_into_current)
  const create_folder_in_current = useAssetStore((store) => store.create_folder_in_current)
  const rename = useAssetStore((store) => store.rename)
  const remove = useAssetStore((store) => store.remove)
  const [dragging_files, set_dragging_files] = useState(false)
  const [menu, set_menu] = useState<MenuState>()
  const [renaming, set_renaming] = useState<string>()
  const [tree_width, set_tree_width] = useState(192)
  // Returning focus to where the menu was opened lets keyboard users continue from there.
  const close_menu = useCallback(() => {
    menu?.trigger.focus()
    set_menu(undefined)
  }, [menu])

  const folder = root && find_folder(root, current_path)
  const segments = current_path ? current_path.split('/') : []

  function on_drag_over(event: DragEvent) {
    if (event.dataTransfer.types.includes('Files')) {
      event.preventDefault()
      set_dragging_files(true)
    }
  }

  function on_drop(event: DragEvent) {
    if (!event.dataTransfer.types.includes('Files')) {
      return
    }
    event.preventDefault()
    set_dragging_files(false)
    void import_into_current(dropped_files(event))
  }

  function open_menu(event: MouseEvent, items: ContextMenuItem[]) {
    event.preventDefault()
    event.stopPropagation()
    set_menu({ x: event.clientX, y: event.clientY, items, trigger: event.currentTarget as HTMLElement })
  }

  async function new_folder() {
    const name = await create_folder_in_current()
    if (name) {
      set_renaming(name)
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
      path: join_path(current_path, entry.name),
      renaming: renaming === entry.name,
      on_context_menu: (event: MouseEvent) =>
        open_menu(event, [
          { label: 'Rename', action: () => set_renaming(entry.name) },
          { label: 'Delete', action: () => confirm_delete(entry) },
        ]),
      on_rename: (new_name: string) => void rename(entry, new_name),
      on_rename_end: () => set_renaming(undefined),
    }
  }

  return (
    <section
      className={`asset-browser${dragging_files ? ' asset-browser-dragging' : ''}`}
      style={{ gridTemplateColumns: `${tree_width}px auto minmax(0, 1fr)` }}
      aria-label="Assets"
      onDragOver={on_drag_over}
      onDragLeave={(event) => {
        // Moving between child elements also fires dragleave; only leaving the panel itself ends the drag.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          set_dragging_files(false)
        }
      }}
      onDrop={on_drop}
    >
      {root ? <AssetTree root={root} /> : <div />}
      <Splitter
        label="Resize folder tree"
        orientation="vertical"
        panel="before"
        size={tree_width}
        min={tree_width_limits.min}
        max={tree_width_limits.max}
        on_resize={set_tree_width}
      />
      <div
        className="asset-content"
        onContextMenu={(event) => open_menu(event, [{ label: 'New folder', action: () => void new_folder() }])}
      >
        <div className="asset-toolbar">
          <nav className="asset-path" aria-label="Asset folder path">
            <PathSegment label="assets" path="" />
            {segments.map((segment, index) => (
              <span key={index}>
                {' / '}
                <PathSegment label={segment} path={segments.slice(0, index + 1).join('/')} />
              </span>
            ))}
          </nav>
          <button type="button" className="asset-toolbar-button" onClick={() => void new_folder()}>
            New folder
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
        {folder && folder.folders.length + folder.files.length === 0 && (
          <p className="asset-hint">Drop images here, or right-click to create a folder.</p>
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
              <AssetTile {...tile_props({ kind: 'file', name: file.name })} thumbnail={<AssetThumbnail file={file} />} />
            </li>
          ))}
        </ul>
      </div>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} on_close={close_menu} />}
    </section>
  )
}
