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
        className={`block w-full overflow-hidden px-2 py-0.5 border-0 rounded text-left text-ellipsis whitespace-nowrap cursor-pointer transition-colors text-[0.85rem] ${
          drop.active ? 'outline-2 outline-accent -outline-offset-2 ' : ''
        }${
          selected && folder.path === current_path
            ? 'bg-control-hover text-accent font-medium'
            : 'bg-transparent text-text hover:bg-control'
        }`}
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
        <ul className="m-0 pl-3 list-none">
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
    <nav className="overflow-auto py-2 px-1" aria-label="Asset folders">
      <ul className="m-0 p-0 list-none">
        {stores.map((store, index) => (
          <AssetBrowserContext key={index} value={store}>
            <RootNode selected={index === selected} on_select={() => on_select(index)} />
          </AssetBrowserContext>
        ))}
      </ul>
    </nav>
  )
}
