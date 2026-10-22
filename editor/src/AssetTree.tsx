import { AssetBrowserContext, useBrowserStore } from './asset_browser_context'
import { useFolderDrop } from './asset_drag'
import type { AssetFolder } from './project/assets'
import type { AssetStoreHook } from './project/asset_store'

type TreeNodeProps = {
  folder: AssetFolder
  // Whether the browser currently shows this node's project folder.
  selected: boolean
  on_select: () => void
}

function TreeNode({ folder, selected, on_select }: TreeNodeProps) {
  const current_path = useBrowserStore((store) => store.current_path)
  const navigate = useBrowserStore((store) => store.navigate)
  const drop = useFolderDrop(folder.path)

  return (
    <li>
      <button
        type="button"
        className={`asset-tree-node${drop.active ? ' drop-target' : ''}`}
        aria-current={selected && folder.path === current_path ? 'location' : undefined}
        onClick={() => {
          on_select()
          navigate(folder.path)
        }}
        {...drop.handlers}
      >
        {folder.name}
      </button>
      {folder.folders.length > 0 && (
        <ul>
          {folder.folders.map((child) => (
            <TreeNode key={child.path} folder={child} selected={selected} on_select={on_select} />
          ))}
        </ul>
      )}
    </li>
  )
}

function RootNode({ selected, on_select }: Omit<TreeNodeProps, 'folder'>) {
  const root = useBrowserStore((store) => store.root)
  return root ? <TreeNode folder={root} selected={selected} on_select={on_select} /> : null
}

type AssetTreeProps = {
  stores: AssetStoreHook[]
  selected: number
  on_select: (index: number) => void
}

export function AssetTree({ stores, selected, on_select }: AssetTreeProps) {
  return (
    <nav className="asset-tree" aria-label="Asset folders">
      <ul>
        {stores.map((store, index) => (
          <AssetBrowserContext key={index} value={store}>
            <RootNode selected={index === selected} on_select={() => on_select(index)} />
          </AssetBrowserContext>
        ))}
      </ul>
    </nav>
  )
}
