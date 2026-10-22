import type { MainModule } from 'seraphim/seraphim.js'
import { find_file_by_id, type AssetFile, type AssetFolder } from '../project/assets'
import type { SceneDocument } from '../project/scene_document'
import { compile_scripts } from './compile'
import { create_api, running } from './seraphim_api'

type Hook = 'on_start' | 'on_tick' | 'on_stop'

type ScriptInstance = {
  path: string
  object: Partial<Record<Hook, () => void>>
  // A script that threw is skipped from then on, so one error does not repeat sixty times a second.
  failed: boolean
}

export type ScriptRun = {
  stop: () => void
}

// Resolves every script the scene uses, in first-use order. Throws when an entity refers to a script that is gone.
function used_scripts(document: SceneDocument, root: AssetFolder): AssetFile[] {
  const used = new Map<string, AssetFile>()
  for (const entity of document.entities) {
    for (const id of entity.components.scripts?.assets ?? []) {
      const file = find_file_by_id(root, id)
      if (!file) {
        throw new Error(`${entity.name} uses a script that is no longer in the scripts folder (${id})`)
      }
      used.set(id, file)
    }
  }
  return [...used.values()]
}

function call(instance: ScriptInstance, hook: Hook): void {
  if (instance.failed) {
    return
  }
  running.script = instance.path
  try {
    instance.object[hook]?.()
  } catch (error) {
    instance.failed = true
    console.error(`${instance.path}: ${hook} failed; the script is stopped until the next Play`, error)
  } finally {
    running.script = ''
  }
}

/**
 * Compiles the scene's scripts, creates one instance per script on every entity, runs on_start and hooks on_tick into
 * the engine's fixed tick. The engine only ticks while it simulates, so the caller starts the simulation afterwards;
 * on_start therefore runs before physics builds its bodies.
 */
export async function start_scripts(
  engine: MainModule,
  document: SceneDocument,
  root: AssetFolder | undefined,
): Promise<ScriptRun> {
  const files = root ? used_scripts(document, root) : []
  if (files.length === 0) {
    return { stop: () => {} }
  }

  const code = await compile_scripts(root!, files)
  const api = create_api(engine)
  const module: { exports: { default?: Record<string, unknown> } } = { exports: {} }
  const require = (name: string) => {
    if (name !== 'seraphim') {
      throw new Error(`Cannot find module '${name}'`)
    }
    return api
  }
  // The bundle is CommonJS so that require('seraphim') hands over this run's API instead of a browser import.
  new Function('require', 'module', 'exports', `${code}\n//# sourceURL=seraphim-scripts.js`)(
    require,
    module,
    module.exports,
  )
  const exported = module.exports.default ?? {}
  const paths = new Map(files.map((file) => [file.id, file.path]))

  const instances: ScriptInstance[] = []
  for (const entity of document.entities) {
    for (const id of entity.components.scripts?.assets ?? []) {
      const path = paths.get(id)!
      const script_class = exported[id]
      if (typeof script_class !== 'function' || !(script_class.prototype instanceof api.Script)) {
        throw new Error(`${path} must have a default export that is a class extending Script`)
      }
      const object = new (script_class as new () => InstanceType<typeof api.Script>)()
      object.entity = new api.Entity(entity.id, entity.name)
      instances.push({ path, object: object as ScriptInstance['object'], failed: false })
    }
  }

  for (const instance of instances) {
    call(instance, 'on_start')
  }
  engine.Engine.set_tick_handler(() => {
    for (const instance of instances) {
      call(instance, 'on_tick')
    }
    api.time.tick += 1
  })

  return {
    stop() {
      engine.Engine.set_tick_handler(null)
      for (const instance of instances) {
        call(instance, 'on_stop')
      }
    },
  }
}
