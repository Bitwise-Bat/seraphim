import { useState, type DragEvent } from 'react'
import { AssetThumbnail } from './AssetThumbnail'
import { find_folder } from './project/assets'
import { use_asset_store } from './project/asset_store'

function dropped_files(event: DragEvent): File[] {
  // Dropped folders also arrive as items; only plain files are imported. Items without an entry are files handed over
  // by script rather than from the file system.
  return [...event.dataTransfer.items]
    .filter((item) => item.kind === 'file' && (item.webkitGetAsEntry()?.isFile ?? true))
    .map((item) => item.getAsFile())
    .filter((file) => file !== null)
}

export function AssetBrowser() {
  const root = use_asset_store((store) => store.root)
  const current_path = use_asset_store((store) => store.current_path)
  const error = use_asset_store((store) => store.error)
  const navigate = use_asset_store((store) => store.navigate)
  const import_into_current = use_asset_store((store) => store.import_into_current)
  const [dragging, set_dragging] = useState(false)

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
            <button type="button" className="asset-tile" onClick={() => navigate(child.path)}>
              <span className="asset-thumbnail asset-thumbnail-label">folder</span>
              <span className="asset-name">{child.name}</span>
            </button>
          </li>
        ))}
        {folder?.files.map((file) => (
          <li key={file.id}>
            <button type="button" className="asset-tile" title={file.path}>
              <AssetThumbnail file={file} />
              <span className="asset-name">{file.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
