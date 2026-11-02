import type { MainModule } from 'seraphim/seraphim.js'
import { create } from 'zustand'
import { connect_to_server, type ServerConnection } from '../network/server_connection'
import { start_scripts, type ScriptRun } from '../scripting/script_host'
import { useAssetStore, useScriptStore } from './asset_store'
import type { AssetFile } from './assets'
import { component_defaults, type SceneDocument, type SceneEntity, type Vec2 } from './scene_document'
import { get_main_scene, main_scene_file, write_main_scene } from './scenes'

type SceneStore = {
  document?: SceneDocument
  selected?: string
  current_scene_name: string
  current_scene_path?: string
  current_scene_handle?: FileSystemFileHandle
  // True while the document has changes that are not saved to disk.
  dirty: boolean
  // While true the engine simulates the scene and the document is frozen, so stopping restores it as it was.
  playing: boolean
  error?: string
  open: (project: FileSystemDirectoryHandle, engine: MainModule) => Promise<void>
  open_scene_file: (file: AssetFile) => Promise<void>
  close: () => void
  save: () => Promise<void>
  // Compiles and starts the scene's scripts first; fails with an error instead of playing when they do not compile.
  play: () => Promise<void>
  stop: () => void
  select: (id: string | undefined) => void
  // Returns the id of the new entity.
  add_entity: () => string
  remove_entity: (id: string) => void
  update_entity: (id: string, change: (entity: SceneEntity) => SceneEntity) => void
  reorder_entity: (source_id: string, target_id?: string, place?: 'before' | 'after') => void
  set_gravity: (gravity: Vec2) => void
  set_clear_color: (color: string) => void
}

function error_message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const useSceneStore = create<SceneStore>()((set, get) => {
  let project: FileSystemDirectoryHandle | undefined
  let engine: MainModule | undefined
  let push_frame: number | undefined
  let scripts: ScriptRun | undefined
  let connection: ServerConnection | undefined
  // Compiling scripts takes a moment, during which a second click on Play must not start another run.
  let starting = false

  // The engine re-creates the whole scene from JSON, so several edits within one frame (a dragged number field) are
  // pushed once.
  function push_to_engine(): void {
    if (push_frame !== undefined) {
      cancelAnimationFrame(push_frame)
      push_frame = undefined
    }
    const { document } = get()
    if (!engine || !document) {
      return
    }
    const problem = engine.Engine.load_scene(JSON.stringify(document))
    if (problem) {
      set({ error: `The engine rejected the scene: ${problem}` })
    }
  }

  function change(document: SceneDocument, selected = get().selected): void {
    // Reloading the engine mid-simulation would throw away the running bodies.
    if (get().playing) {
      return
    }
    set({ document, selected, dirty: true })
    push_frame ??= requestAnimationFrame(push_to_engine)
  }

  function change_entities(change_list: (entities: SceneEntity[]) => SceneEntity[], selected?: string): void {
    const { document } = get()
    if (document) {
      change({ ...document, entities: change_list(document.entities) }, selected)
    }
  }

  return {
    current_scene_name: main_scene_file,
    current_scene_path: undefined,
    current_scene_handle: undefined,
    dirty: false,
    playing: false,

    async open(next_project, next_engine) {
      project = next_project
      engine = next_engine
      set({
        document: undefined,
        selected: undefined,
        dirty: false,
        playing: false,
        error: undefined,
        current_scene_name: main_scene_file,
        current_scene_path: main_scene_file,
        current_scene_handle: undefined,
      })
      try {
        const { text, handle } = await get_main_scene(next_project)
        const problem = next_engine.Engine.load_scene(text)
        if (problem) {
          set({ error: `The main scene could not be loaded: ${problem}` })
          return
        }
        // The engine fills in missing fields and drops unknown components, so its copy is what the editor edits.
        set({
          document: JSON.parse(next_engine.World.save_scene()) as SceneDocument,
          current_scene_handle: handle,
          current_scene_name: main_scene_file,
          current_scene_path: main_scene_file,
        })
        void useAssetStore.getState().scan(next_project)
      } catch (error) {
        set({ error: error_message(error) })
      }
    },

    async open_scene_file(file) {
      if (!engine || !project) {
        return
      }
      if (get().playing) {
        set({ error: 'Cannot switch scenes while simulation is playing. Please stop first.' })
        return
      }
      if (get().dirty) {
        const should_save = window.confirm(
          `"${get().current_scene_name}" has unsaved changes. Would you like to save before opening "${file.name}"?`,
        )
        if (should_save) {
          await get().save()
        }
      }
      try {
        const blob = await file.handle.getFile()
        const text = await blob.text()
        const problem = engine.Engine.load_scene(text)
        if (problem) {
          set({ error: `The scene could not be loaded: ${problem}` })
          return
        }
        set({
          document: JSON.parse(engine.World.save_scene()) as SceneDocument,
          selected: undefined,
          dirty: false,
          error: undefined,
          current_scene_name: file.name,
          current_scene_path: file.path,
          current_scene_handle: file.handle,
        })
      } catch (error) {
        set({ error: `Failed to open scene: ${error_message(error)}` })
      }
    },

    async save() {
      // The engine holds the simulated scene, not the document, until play stops.
      if (!project || !engine || !get().document || get().playing) {
        return
      }
      push_to_engine()
      const saved = get().document
      // Writing the engine's serialization keeps the file format owned by one place.
      const text = engine.World.save_scene()
      // The engine returns nothing once it has stopped running; writing that would wipe the scene file.
      if (!text) {
        set({ error: 'Saving failed: the engine is not running, so the scene file was left unchanged' })
        return
      }
      try {
        const handle = get().current_scene_handle
        if (handle) {
          const writable = await handle.createWritable()
          await writable.write(text)
          await writable.close()
        } else {
          const new_handle = await write_main_scene(project, text)
          set({ current_scene_handle: new_handle })
        }
        // Edits made while the file was being written are still unsaved.
        set({ dirty: get().document !== saved, error: undefined })
      } catch (error) {
        set({ error: `Saving failed: ${error_message(error)}` })
      }
    },

    async play() {
      const { document } = get()
      if (!engine || !project || !document || get().playing || starting) {
        return
      }
      starting = true
      try {
        push_to_engine()
        connection = connect_to_server(engine)
        scripts = await start_scripts(engine, connection, project, document, useScriptStore.getState().root)
        engine.Engine.start_simulation()
        set({ playing: true, error: undefined })
      } catch (error) {
        connection?.close()
        connection = undefined
        set({ error: `Play failed: ${error_message(error)}` })
      } finally {
        starting = false
      }
    },

    stop() {
      if (!engine || !get().playing) {
        return
      }
      connection?.close()
      connection = undefined
      scripts?.stop()
      scripts = undefined
      engine.Engine.stop_simulation()
      set({ playing: false })
      push_to_engine()
    },

    close() {
      if (push_frame !== undefined) {
        cancelAnimationFrame(push_frame)
        push_frame = undefined
      }
      if (get().playing) {
        connection?.close()
        connection = undefined
        scripts?.stop()
        scripts = undefined
        engine?.Engine.stop_simulation()
      }
      project = undefined
      set({
        document: undefined,
        selected: undefined,
        current_scene_name: main_scene_file,
        current_scene_path: undefined,
        current_scene_handle: undefined,
        dirty: false,
        playing: false,
        error: undefined,
      })
    },

    select(id) {
      set({ selected: id })
    },

    add_entity() {
      const entity: SceneEntity = {
        id: crypto.randomUUID(),
        name: 'Entity',
        components: { transform: component_defaults.transform() },
      }
      change_entities((entities) => [...entities, entity], entity.id)
      return entity.id
    },

    remove_entity(id) {
      const selected = get().selected === id ? undefined : get().selected
      change_entities((entities) => entities.filter((entity) => entity.id !== id), selected)
    },

    update_entity(id, update) {
      change_entities((entities) => entities.map((entity) => (entity.id === id ? update(entity) : entity)))
    },

    reorder_entity(source_id, target_id, place = 'before') {
      if (source_id === target_id) return
      change_entities((entities) => {
        const from_index = entities.findIndex((e) => e.id === source_id)
        if (from_index === -1) return entities
        const item = entities[from_index]
        const remaining = entities.filter((e) => e.id !== source_id)
        if (!target_id) {
          return [...remaining, item]
        }
        const to_index = remaining.findIndex((e) => e.id === target_id)
        if (to_index === -1) return [...remaining, item]
        const insert_at = place === 'after' ? to_index + 1 : to_index
        return [...remaining.slice(0, insert_at), item, ...remaining.slice(insert_at)]
      })
    },

    set_gravity(gravity) {
      const { document } = get()
      if (document) {
        change({ ...document, gravity })
      }
    },
    
    set_clear_color(color){
      const { document } = get()
      if (document) {
        change({...document, clear_color: color})
        if (engine)
          engine.Engine.set_clear_color(color)
      }
    }
  }
})
