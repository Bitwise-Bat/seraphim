import { create } from 'zustand'
import {
  assets_folder,
  create_folder,
  delete_entry,
  find_folder,
  import_files,
  is_inside,
  join_path,
  move_entry,
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
  // Resolves to the new folder's name, so the browser can start renaming it.
  create_folder_in_current: () => Promise<string | undefined>
  rename: (entry: AssetEntry, new_name: string) => Promise<void>
  move: (source_path: string, entry: AssetEntry, target_path: string) => Promise<void>
  remove: (entry: AssetEntry) => Promise<void>
  navigate: (path: string) => void
}

function error_message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function folder_at(root: AssetFolder, path: string): AssetFolder {
  const folder = find_folder(root, path)
  if (!folder) {
    throw new Error(`The folder ${path || 'assets'} no longer exists`)
  }
  return folder
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
  function change(task: (root: AssetFolder) => Promise<void>): Promise<void> {
    return serialized(async () => {
      const { root } = get()
      if (!root) {
        return
      }
      let failure: string | undefined
      try {
        await task(root)
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

  const current = (root: AssetFolder) => folder_at(root, get().current_path).handle

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

    import_into_current: (files) => change((root) => import_files(current(root), files)),

    async create_folder_in_current() {
      let name: string | undefined
      await change(async (root) => {
        name = await create_folder(current(root))
      })
      return name
    },

    rename: (entry, new_name) => change((root) => rename_entry(current(root), entry, new_name)),

    move: (source_path, entry, target_path) =>
      change(async (root) => {
        if (entry.kind === 'directory' && is_inside(target_path, join_path(source_path, entry.name))) {
          throw new Error(`${entry.name} cannot be moved into itself`)
        }
        await move_entry(folder_at(root, source_path).handle, entry, folder_at(root, target_path).handle)
      }),

    remove: (entry) => change((root) => delete_entry(current(root), entry)),

    navigate(path) {
      set({ current_path: path })
    },
  }
})
