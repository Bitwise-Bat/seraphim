import { useFolderDrop } from './asset_drag'
import type { AssetFolder } from './project/assets'
import { useAssetStore } from './project/asset_store'

function TreeNode({ folder, label }: { folder: AssetFolder; label: string }) {
  const current_path = useAssetStore((store) => store.current_path)
  const navigate = useAssetStore((store) => store.navigate)
  const drop = useFolderDrop(folder.path)

  return (
    <li>
      <button
        type="button"
        className={`asset-tree-node${drop.active ? ' drop-target' : ''}`}
        aria-current={folder.path === current_path ? 'location' : undefined}
        onClick={() => navigate(folder.path)}
        {...drop.handlers}
      >
        {label}
      </button>
      {folder.folders.length > 0 && (
        <ul>
          {folder.folders.map((child) => (
            <TreeNode key={child.path} folder={child} label={child.name} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function AssetTree({ root }: { root: AssetFolder }) {
  return (
    <nav className="asset-tree" aria-label="Asset folders">
      <ul>
        <TreeNode folder={root} label="assets" />
      </ul>
    </nav>
  )
}
