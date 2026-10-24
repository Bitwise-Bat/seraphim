import { running, type World, type WorldApi } from './world_api.ts'

type Hook = 'on_start' | 'on_tick' | 'on_stop'

type ScriptInstance = {
  path: string
  object: Partial<Record<Hook, () => void>>
  // A script that threw is skipped from then on, so one error does not repeat sixty times a second.
  failed: boolean
}

// What the compiled bundle exports: every script's asset id mapped to its path inside scripts/ and its default export.
type Bundle = Record<string, { path: string; script: unknown }>

// An entity as the scene file stores it, reduced to what the host reads.
export type ScriptedEntity = {
  id: string
  name: string
  components: { scripts?: { assets: string[] } }
}

export type ScriptRun = {
  stop: () => void
}

function load_bundle(code: string, api: WorldApi): Bundle {
  const module: { exports: { default?: Bundle } } = { exports: {} }
  const require = (name: string) => {
    if (name !== 'seraphim') {
      throw new Error(`Cannot find module '${name}'`)
    }
    return api
  }
  // The bundle is CommonJS so that require('seraphim') hands over this run's API instead of an import.
  new Function('require', 'module', 'exports', `${code}\n//# sourceURL=seraphim-scripts.js`)(
    require,
    module,
    module.exports,
  )
  return module.exports.default ?? {}
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
    console.error(`${instance.path}: ${hook} failed; the script is stopped until the next run`, error)
  } finally {
    running.script = ''
  }
}

/**
 * Creates one instance per script on every entity, runs on_start and hooks on_tick into the world's fixed tick. The
 * world only ticks while it simulates, so the caller starts the simulation afterwards; on_start therefore runs before
 * physics builds its bodies.
 */
export function run_scripts(world: World, api: WorldApi, code: string, entities: ScriptedEntity[]): ScriptRun {
  const bundle = load_bundle(code, api)

  const instances: ScriptInstance[] = []
  for (const entity of entities) {
    for (const id of entity.components.scripts?.assets ?? []) {
      const compiled = bundle[id]
      if (!compiled) {
        throw new Error(`${entity.name} uses a script that is not in the compiled scripts (${id})`)
      }
      const script_class = compiled.script
      if (typeof script_class !== 'function' || !(script_class.prototype instanceof api.Script)) {
        throw new Error(`${compiled.path} must have a default export that is a class extending Script`)
      }
      const object = new (script_class as new () => InstanceType<WorldApi['Script']>)()
      object.entity = new api.Entity(entity.id, entity.name)
      instances.push({ path: compiled.path, object: object as ScriptInstance['object'], failed: false })
    }
  }

  for (const instance of instances) {
    call(instance, 'on_start')
  }
  world.set_tick_handler(() => {
    for (const instance of instances) {
      call(instance, 'on_tick')
    }
    api.time.tick += 1
  })

  return {
    stop() {
      world.set_tick_handler(null)
      for (const instance of instances) {
        call(instance, 'on_stop')
      }
    },
  }
}
