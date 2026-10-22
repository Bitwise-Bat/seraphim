import { create } from 'zustand'
import { create_project, read_project, write_script_setup, type ProjectManifest } from './project'
import { load_recent_project, save_recent_project } from './recent_project'

export type ProjectState =
  | { status: 'unsupported' }
  | { status: 'loading' }
  | { status: 'closed'; recent?: FileSystemDirectoryHandle; error?: string }
  | { status: 'open'; directory: FileSystemDirectoryHandle; manifest: ProjectManifest }

type ProjectStore = {
  state: ProjectState
  restore: () => Promise<void>
  reopen: () => Promise<void>
  open: () => Promise<void>
  create: () => Promise<void>
}

const permission = { mode: 'readwrite' } as const

function error_message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// The user closing the picker is not an error worth reporting.
function is_cancelled(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

async function pick_directory(): Promise<FileSystemDirectoryHandle> {
  if (!window.showDirectoryPicker) {
    throw new Error('This browser cannot open project folders')
  }
  // The id makes the picker start in the folder chosen last time.
  return window.showDirectoryPicker({ id: 'seraphim-project', mode: 'readwrite' })
}

export const useProjectStore = create<ProjectStore>()((set, get) => {
  async function load(directory: FileSystemDirectoryHandle, read: typeof read_project): Promise<void> {
    try {
      const manifest = await read(directory)
      await write_script_setup(directory)
      await save_recent_project(directory)
      set({ state: { status: 'open', directory, manifest } })
    } catch (error) {
      set({ state: { status: 'closed', error: error_message(error) } })
    }
  }

  async function pick_and_load(read: typeof read_project): Promise<void> {
    try {
      await load(await pick_directory(), read)
    } catch (error) {
      if (!is_cancelled(error)) {
        set({ state: { status: 'closed', error: error_message(error) } })
      }
    }
  }

  return {
    state: window.showDirectoryPicker ? { status: 'loading' } : { status: 'unsupported' },

    async restore() {
      if (get().state.status !== 'loading') {
        return
      }
      const recent = await load_recent_project()
      // Browsers forget the permission between sessions; asking again needs a click, so only reopen silently when
      // the grant is still active.
      if (recent && (await recent.queryPermission(permission)) === 'granted') {
        await load(recent, read_project)
      } else {
        set({ state: { status: 'closed', recent } })
      }
    },

    async reopen() {
      const { state } = get()
      if (state.status !== 'closed' || !state.recent) {
        return
      }
      if ((await state.recent.requestPermission(permission)) === 'granted') {
        await load(state.recent, read_project)
      }
    },

    open: () => pick_and_load(read_project),
    create: () => pick_and_load(create_project),
  }
})
