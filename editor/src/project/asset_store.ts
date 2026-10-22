import { create } from 'zustand'
import {
  assets_folder,
  delete_entry,
  find_folder,
  import_files,
  rename_entry,
  scan_folder,
  type AssetEntry,
  type AssetFolder,
} from './assets'

type AssetStore = {
  root?: AssetFolder
  current_path: string
  error?: string
  scan: (project: FileSystemDirectoryHandle) => Promise<void>
  import_into_current: (files: File[]) => Promise<void>
  rename: (entry: AssetEntry, new_name: string) => Promise<void>
  remove: (entry: AssetEntry) => Promise<void>
  navigate: (path: string) => void
}

function error_message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const useAssetStore = create<AssetStore>()((set, get) => {
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

  // Rescans even when the change fails halfway, so the browser always shows what is actually on disk.
  function change_current_folder(change: (folder: FileSystemDirectoryHandle) => Promise<void>): Promise<void> {
    return serialized(async () => {
      const { root, current_path } = get()
      const folder = root && find_folder(root, current_path)
      if (!root || !folder) {
        return
      }
      let failure: string | undefined
      try {
        await change(folder.handle)
      } catch (error) {
        failure = error_message(error)
      }
      try {
        await rescan(root.handle)
      } catch (error) {
        failure ??= error_message(error)
      }
      if (failure) {
        set({ error: failure })
      }
    })
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

    import_into_current: (files) => change_current_folder((folder) => import_files(folder, files)),
    rename: (entry, new_name) => change_current_folder((folder) => rename_entry(folder, entry, new_name)),
    remove: (entry) => change_current_folder((folder) => delete_entry(folder, entry)),

    navigate(path) {
      set({ current_path: path })
    },
  }
})
