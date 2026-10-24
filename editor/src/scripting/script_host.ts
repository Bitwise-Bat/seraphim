import type { MainModule } from 'seraphim/seraphim.js'
import { run_scripts, type ScriptRun } from '../../../runtime/script_host.ts'
import { find_file_by_id, type AssetFile, type AssetFolder } from '../project/assets'
import { write_scripts_bundle } from '../project/project'
import type { SceneDocument } from '../project/scene_document'
import { compile_scripts } from './compile'
import { create_api } from './seraphim_api'

export type { ScriptRun }

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

// Compiles the scene's scripts and runs them in the editor's engine. The bundle is also written into the project, so
// the server runs the same scripts as the last Play.
export async function start_scripts(
  engine: MainModule,
  project: FileSystemDirectoryHandle,
  document: SceneDocument,
  root: AssetFolder | undefined,
): Promise<ScriptRun> {
  const files = root ? used_scripts(document, root) : []
  const code = files.length > 0 ? await compile_scripts(root!, files) : ''
  await write_scripts_bundle(project, code)
  return run_scripts(engine.World, create_api(engine), code, document.entities)
}
