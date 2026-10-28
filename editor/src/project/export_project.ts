import JSZip from 'jszip'
import debug_wasm_url from 'seraphim/seraphim.wasm?url'
import debug_js_url from 'seraphim/seraphim.js?url'
import release_wasm_url from 'seraphim-release/seraphim.wasm?url'
import release_js_url from 'seraphim-release/seraphim.js?url'
import { compile_side, used_scripts } from '../scripting/script_host'
import { script_side } from '../scripting/compile'
import { files_in, type AssetFolder } from './assets'
import { build_player_bundle } from './build_player'
import type { SceneDocument } from './scene_document'
import { read_main_scene } from './scenes'

type EngineAssets = {
  wasm: ArrayBuffer
  js: string
}

async function load_engine_files(): Promise<EngineAssets> {
  // First attempt to load the optimized web-release preset.
  try {
    const [wasm_res, js_res] = await Promise.all([fetch(release_wasm_url), fetch(release_js_url)])
    if (wasm_res.ok && js_res.ok) {
      return {
        wasm: await wasm_res.arrayBuffer(),
        js: await js_res.text(),
      }
    }
  } catch {
    // If web-release is missing or fails, fall back to current preset below.
  }

  const [wasm_res, js_res] = await Promise.all([fetch(debug_wasm_url), fetch(debug_js_url)])
  if (!wasm_res.ok || !js_res.ok) {
    throw new Error('Failed to load Seraphim engine files for export')
  }

  return {
    wasm: await wasm_res.arrayBuffer(),
    js: await js_res.text(),
  }
}

function generate_index_html(game_title: string): string {
  const safe_title = game_title.replace(/[<>&"]/g, '')
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safe_title}</title>
    <style>
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      html,
      body {
        width: 100%;
        height: 100%;
        overflow: hidden;
        background-color: #0d0f12;
        color: #e2e8f0;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      #seraphim-container {
        position: relative;
        width: 100vw;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #seraphim-canvas {
        width: 100%;
        height: 100%;
        display: block;
        outline: none;
      }
      .seraphim-ui,
      #seraphim-ui {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }
      #loading {
        position: absolute;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        pointer-events: none;
        transition: opacity 0.3s ease;
      }
      #loading.hidden {
        opacity: 0;
        pointer-events: none;
      }
      .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid rgba(255, 255, 255, 0.2);
        border-top-color: #38bdf8;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      #error-overlay {
        position: absolute;
        top: 1rem;
        left: 1rem;
        right: 1rem;
        padding: 1rem;
        background: rgba(239, 68, 68, 0.95);
        color: #fff;
        border-radius: 6px;
        font-family: monospace;
        font-size: 0.875rem;
        white-space: pre-wrap;
        display: none;
        z-index: 1000;
      }
    </style>
  </head>
  <body>
    <div id="seraphim-container">
      <canvas id="seraphim-canvas" tabindex="0"></canvas>
      <div id="seraphim-ui" class="seraphim-ui"></div>
      <div id="loading">
        <div class="spinner"></div>
        <div>Loading ${safe_title}...</div>
      </div>
      <div id="error-overlay"></div>
    </div>
    <script type="module" src="./player.js"></script>
  </body>
</html>
`
}

export async function export_project_zip(
  project: FileSystemDirectoryHandle,
  document: SceneDocument | undefined,
  asset_root: AssetFolder | undefined,
  script_root: AssetFolder | undefined,
): Promise<void> {
  const zip = new JSZip()
  const project_name = project.name || 'seraphim-game'

  // 1. Scene file
  let scene_text: string
  let scene_doc: SceneDocument
  if (document) {
    scene_doc = document
    scene_text = JSON.stringify(document, null, 2)
  } else {
    scene_text = await read_main_scene(project)
    scene_doc = JSON.parse(scene_text) as SceneDocument
  }
  zip.file('scene.json', scene_text)

  // 2. Compile client and shared scripts
  let client_scripts = ''
  if (script_root) {
    const files = used_scripts(scene_doc, script_root)
    const sides = await Promise.all(files.map(async (f) => script_side(await (await f.handle.getFile()).text())))
    client_scripts = await compile_side(script_root, files, sides, 'server')
  }
  zip.file('scripts.bundle.js', client_scripts)

  // 3. Package project assets and build manifest
  const manifest = {
    name: project_name,
    assets: {} as Record<string, string>,
  }

  if (asset_root) {
    for (const file of files_in(asset_root)) {
      const blob = await file.handle.getFile()
      const rel_path = `assets/${file.path}`
      zip.file(rel_path, blob)
      manifest.assets[file.id] = `./${rel_path}`
    }
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))

  // 4. Fetch engine Wasm and JS
  const { wasm, js } = await load_engine_files()
  zip.file('seraphim.wasm', wasm)
  zip.file('seraphim.js', js)

  // 5. Generate player bundle directly from real runtime files
  zip.file('index.html', generate_index_html(project_name))
  const player_js = await build_player_bundle()
  zip.file('player.js', player_js)

  // 6. Generate ZIP file and trigger browser download
  const zip_blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  const blob_url = URL.createObjectURL(zip_blob)
  const download_link = window.document.createElement('a')
  download_link.href = blob_url
  download_link.download = `${project_name}-web.zip`
  window.document.body.appendChild(download_link)
  download_link.click()
  download_link.remove()
  setTimeout(() => URL.revokeObjectURL(blob_url), 5000)
}
