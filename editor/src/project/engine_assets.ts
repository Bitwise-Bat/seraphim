import type { MainModule } from 'seraphim/seraphim.js'
import { files_in, type AssetFolder } from './assets'

type RegisteredAsset = {
  url: string
  // Changes whenever the file moves or its contents change.
  version: string
}

const registered = new Map<string, RegisteredAsset>()
let pending: Promise<void> = Promise.resolve()

async function sync(engine: MainModule, root: AssetFolder): Promise<void> {
  const present = new Set<string>()
  for (const file of files_in(root)) {
    present.add(file.id)
    const data = await file.handle.getFile()
    const version = `${file.path}|${data.lastModified}|${data.size}`
    const current = registered.get(file.id)
    if (current?.version === version) {
      continue
    }
    // A blob URL reads from the file it was made from, which stops working once that file moves or changes.
    if (current) {
      URL.revokeObjectURL(current.url)
    }
    const url = URL.createObjectURL(data)
    registered.set(file.id, { url, version })
    engine.Engine.register_asset(file.id, url)
  }

  for (const [id, asset] of registered) {
    if (!present.has(id)) {
      URL.revokeObjectURL(asset.url)
      registered.delete(id)
    }
  }
}

// Tells the engine where to fetch every asset in the project, registering again only the ones that changed.
export function sync_engine_assets(engine: MainModule, root: AssetFolder): Promise<void> {
  pending = pending.then(() => sync(engine, root))
  return pending
}
