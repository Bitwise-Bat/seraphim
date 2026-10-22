import { create } from 'zustand'
import { assets_folder, find_folder, import_files, scan_folder, type AssetFolder } from './assets'

type AssetStore = {
  root?: AssetFolder
  current_path: string
  error?: string
  scan: (project: FileSystemDirectoryHandle) => Promise<void>
  import_into_current: (files: File[]) => Promise<void>
  navigate: (path: string) => void
}

function error_message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const use_asset_store = create<AssetStore>()((set, get) => {
  // Scans and imports write .meta files, so two running at once could each create metadata for the same asset.
  let pending: Promise<void> = Promise.resolve()
  function serialized(task: () => Promise<void>): Promise<void> {
    pending = pending.then(task, task)
    return pending
  }

  async function rescan(handle: FileSystemDirectoryHandle): Promise<void> {
    const root = await scan_folder(handle, '')
    // Stay in the current folder unless it disappeared since the last scan.
    const current_path = find_folder(root, get().current_path) ? get().current_path : ''
    set({ root, current_path, error: undefined })
  }

  return {
    current_path: '',

    scan: (project) =>
      serialized(async () => {
        try {
          await rescan(await project.getDirectoryHandle(assets_folder, { create: true }))
        } catch (error) {
          set({ error: error_message(error) })
        }
      }),

    import_into_current: (files) =>
      serialized(async () => {
        const { root, current_path } = get()
        const folder = root && find_folder(root, current_path)
        if (!root || !folder) {
          return
        }
        try {
          await import_files(folder.handle, files)
          await rescan(root.handle)
        } catch (error) {
          set({ error: error_message(error) })
        }
      }),

    navigate(path) {
      set({ current_path: path })
    },
  }
})
