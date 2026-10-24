import type { MainModule } from 'seraphim/seraphim.js'
import type { ServerConnection } from '../network/server_connection'
import { run_scripts, type ScriptRun } from '../../../runtime/script_host.ts'
import { find_file_by_id, type AssetFile, type AssetFolder } from '../project/assets'
import { write_server_bundle } from '../project/project'
import type { SceneDocument } from '../project/scene_document'
import { compile_scripts, script_side, type ScriptSide } from './compile'
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

async function compile_side(root: AssetFolder, files: AssetFile[], sides: ScriptSide[], skipped: ScriptSide) {
  const included = files.filter((_, index) => sides[index] !== skipped)
  return included.length > 0 ? compile_scripts(root, included) : ''
}

// Runs the client and shared scripts in the editor's engine. The server and shared scripts are compiled into a second
// bundle in the project, which the server runs; client scripts never reach that bundle, nor server scripts the editor.
export async function start_scripts(
  engine: MainModule,
  connection: ServerConnection,
  project: FileSystemDirectoryHandle,
  document: SceneDocument,
  root: AssetFolder | undefined,
): Promise<ScriptRun> {
  const files = root ? used_scripts(document, root) : []
  const sides = await Promise.all(files.map(async (file) => script_side(await (await file.handle.getFile()).text())))
  const client_code = await compile_side(root!, files, sides, 'server')
  await write_server_bundle(project, await compile_side(root!, files, sides, 'client'))
  return run_scripts(engine.World, create_api(engine, connection), client_code, document.entities)
}
