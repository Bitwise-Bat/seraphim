import type { MainModule } from 'seraphim/seraphim.js'
import { run_scripts, type ScriptedEntity } from '../../../runtime/script_host.ts'
import type { ServerConnection } from '../network/server_connection'
import { create_api } from '../scripting/seraphim_api'

declare function create_seraphim(options: unknown): Promise<MainModule>

async function bootstrap() {
  const canvas = document.getElementById('seraphim-canvas') as HTMLCanvasElement
  const loading = document.getElementById('loading')
  const error_overlay = document.getElementById('error-overlay')

  function show_error(err: unknown) {
    console.error(err)
    if (error_overlay) {
      error_overlay.style.display = 'block'
      error_overlay.textContent = 'Error: ' + (err instanceof Error ? err.stack || err.message : String(err))
    }
    if (loading) loading.style.display = 'none'
  }

  try {
    const engine = await create_seraphim({
      canvas,
      locateFile: (p: string) => (p.endsWith('.wasm') ? './seraphim.wasm' : p),
    })

    const manifest_res = await fetch('./manifest.json')
    if (!manifest_res.ok) throw new Error('Failed to load manifest.json')
    const manifest = (await manifest_res.json()) as { assets?: Record<string, string> }

    for (const [id, path] of Object.entries(manifest.assets ?? {})) {
      engine.Engine.register_asset(id, path)
    }

    const scene_res = await fetch('./scene.json')
    if (!scene_res.ok) throw new Error('Failed to load scene.json')
    const scene_text = await scene_res.text()
    const problem = engine.Engine.load_scene(scene_text)
    if (problem) throw new Error('Engine rejected scene: ' + problem)

    let script_code = ''
    try {
      const scripts_res = await fetch('./scripts.bundle.js')
      if (scripts_res.ok) {
        script_code = await scripts_res.text()
      }
    } catch {
      // No scripts in project
    }

    const scene_doc = JSON.parse(scene_text) as { entities?: ScriptedEntity[] }
    const dummy_connection: ServerConnection = {
      send: () => {},
      on: () => {},
      off: () => {},
      close: () => {},
    }

    const api = create_api(engine, dummy_connection)
    run_scripts(engine.World, api, script_code, scene_doc.entities ?? [])

    engine.Engine.start_simulation()

    if (loading) loading.classList.add('hidden')
    canvas.focus()
  } catch (err) {
    show_error(err)
  }
}

void bootstrap()
