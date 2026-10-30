import {
  useCallback,
  useState,
  type Dispatch,
  type DragEvent,
  type MouseEvent,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { AssetBrowserContext, useBrowserStore } from './asset_browser_context'
import { start_asset_drag, useFolderDrop } from './asset_drag'
import { AssetThumbnail, is_image_file } from './AssetThumbnail'
import { AssetTree } from './AssetTree'
import { ContextMenu, type ContextMenuItem } from './ContextMenu'
import { find_folder, join_path, type AssetEntry, type AssetFile } from './project/assets'
import { useSettingsStore } from './settings_store'
import { useAssetStore, useScriptStore, type AssetStoreHook } from './project/asset_store'
import { script_template } from './project/scripts'
import { RenameInput } from './RenameInput'
import { Splitter } from './Splitter'
import { ImagePreviewDialog } from './ImagePreviewDialog'

const tree_width_limits = { min: 120, max: 480 }

type NewFile = { label: string; name: string; contents: string }

const folders: { store: AssetStoreHook; hint: string; new_file?: NewFile }[] = [
  { store: useAssetStore, hint: 'Drop images here, or right-click to create a folder.' },
  {
    store: useScriptStore,
    hint: 'Drop .ts or .js files here, or right-click to create a script or folder.',
    new_file: { label: 'New script', ...script_template },
  },
]

function dropped_files(event: DragEvent): File[] {
  // Dropped folders also arrive as items; only plain files are imported. Items without an entry are files handed over
  // by script rather than from the file system.
  return [...event.dataTransfer.items]
    .filter((item) => item.kind === 'file' && (item.webkitGetAsEntry()?.isFile ?? true))
    .map((item) => item.getAsFile())
    .filter((file) => file !== null)
}

function PathSegment({ label, path }: { label: string; path: string }) {
  const navigate = useBrowserStore((store) => store.navigate)
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
  on_double_click?: () => void
}

function AssetTile({ entry, path, thumbnail, renaming, on_open, on_context_menu, on_rename, on_rename_end, on_double_click }: AssetTileProps) {
  const folder = useBrowserStore((store) => store.folder)
  const current_path = useBrowserStore((store) => store.current_path)
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
      onDragStart={(event) => start_asset_drag(event, folder, { source_path: current_path, entry })}
      onClick={on_open}
      onContextMenu={on_context_menu}
      onDoubleClick={() => on_double_click()}
      {...drop_props}
    >
      {thumbnail}
      <span className="asset-name">{entry.name}</span>
    </button>
  )
}

type MenuState = { x: number; y: number; items: ContextMenuItem[]; trigger: HTMLElement }

export function AssetBrowser() {
  const [selected, set_selected] = useState(0)
  const tree_width = useSettingsStore((store) => store.asset_tree_width)
  const set_setting = useSettingsStore((store) => store.set_setting)
  const set_tree_width = (width: SetStateAction<number>) => set_setting('asset_tree_width', width)

  return (
    <AssetBrowserContext value={folders[selected].store}>
      <FolderBrowser
        // Renaming and open menus refer to entries of one folder, so switching folders starts afresh.
        key={selected}
        hint={folders[selected].hint}
        new_file={folders[selected].new_file}
        tree={<AssetTree stores={folders.map(({ store }) => store)} selected={selected} on_select={set_selected} />}
        tree_width={tree_width}
        on_tree_resize={set_tree_width}
      />
    </AssetBrowserContext>
  )
}

type FolderBrowserProps = {
  hint: string
  new_file?: NewFile
  tree: ReactNode
  tree_width: number
  on_tree_resize: Dispatch<SetStateAction<number>>
}

function FolderBrowser({ hint, new_file, tree, tree_width, on_tree_resize }: FolderBrowserProps) {
  const folder_name = useBrowserStore((store) => store.folder)
  const root = useBrowserStore((store) => store.root)
  const current_path = useBrowserStore((store) => store.current_path)
  const error = useBrowserStore((store) => store.error)
  const navigate = useBrowserStore((store) => store.navigate)
  const import_into_current = useBrowserStore((store) => store.import_into_current)
  const create_folder_in_current = useBrowserStore((store) => store.create_folder_in_current)
  const create_file_in_current = useBrowserStore((store) => store.create_file_in_current)
  const rename = useBrowserStore((store) => store.rename)
  const remove = useBrowserStore((store) => store.remove)
  const find_id = useBrowserStore((store) => store.find_id);
  const [dragging_files, set_dragging_files] = useState(false)
  const [menu, set_menu] = useState<MenuState>()
  const [renaming, set_renaming] = useState<string>()
  const [preview_file, set_preview_file] = useState<AssetFile>()
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

  console.log(preview_file)

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

  async function create_new_file(file: NewFile) {
    const name = await create_file_in_current(file.name, file.contents)
    if (name) {
      set_renaming(name)
    }
  }

  const create_actions: ContextMenuItem[] = [
    ...(new_file ? [{ label: new_file.label, action: () => void create_new_file(new_file) }] : []),
    { label: 'New folder', action: () => void new_folder() },
  ]

  function confirm_delete(entry: AssetEntry) {
    const what = entry.kind === 'directory' ? `the folder "${entry.name}" and everything in it` : `"${entry.name}"`
    if (window.confirm(`Delete ${what}? This cannot be undone.`)) {
      void remove(entry)
    }
  }
  
  async function copy_uuid(entry: AssetEntry, path: string){
    const id = await find_id(entry, path);
    if (!id) return console.error("File doesn't have UUID");
    await navigator.clipboard.writeText(id);
  }

  function tile_props(entry: AssetEntry) {
    const path = join_path(current_path, entry.name);
    
    return {
      entry,
      path: path,
      renaming: renaming === entry.name,
      on_context_menu: (event: MouseEvent) => {
        const context_options : ContextMenuItem[] = [];

        if (entry.kind === "file")
          context_options.push({ label: "Copy UUID", action: () => copy_uuid(entry, path)});

        context_options.push(
            { label: 'Rename', action: () => set_renaming(entry.name) },
            { label: 'Delete', action: () => confirm_delete(entry) },
        );
        open_menu(event, context_options)
      },
      on_rename: (new_name: string) => void rename(entry, new_name),
      on_rename_end: () => set_renaming(undefined),
    }
  }

  return (
    <>
      {preview_file && <ImagePreviewDialog file={preview_file} on_close={() => set_preview_file(undefined)} />}
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
        {tree}
        <Splitter
          label="Resize folder tree"
          orientation="vertical"
          panel="before"
          size={tree_width}
          min={tree_width_limits.min}
          max={tree_width_limits.max}
          on_resize={on_tree_resize}
        />
        <div
          className="asset-content"
          onContextMenu={(event) => open_menu(event, create_actions)}
        >
          <div className="asset-toolbar">
            <nav className="asset-path" aria-label="Asset folder path">
              <PathSegment label={folder_name} path="" />
              {segments.map((segment, index) => (
                <span key={index}>
                  {' / '}
                  <PathSegment label={segment} path={segments.slice(0, index + 1).join('/')} />
                </span>
              ))}
            </nav>
            <div className="asset-toolbar-actions">
              {create_actions.map(({ label, action }) => (
                <button key={label} type="button" className="asset-toolbar-button" onClick={action}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {error && <p role="alert">{error}</p>}
          {folder && folder.folders.length + folder.files.length === 0 && <p className="asset-hint">{hint}</p>}
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
                  on_double_click={is_image_file(file.name) ? () => set_preview_file(file) : undefined}
                />
              </li>
            ))}
          </ul>
        </div>
        {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} on_close={close_menu} />}
      </section>
    </>
  )
}
