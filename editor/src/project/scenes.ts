export const main_scene_file = 'main.scene.json'
export const scene_extension = '.scene.json'
export const empty_scene = `${JSON.stringify({ format_version: 1, entities: [] }, null, 2)}\n`

export const scene_template = {
  label: 'New scene',
  name: 'new.scene.json',
  contents: empty_scene,
}

export function is_scene_file(name: string): boolean {
  return name.endsWith('.scene.json') || name.endsWith('.scene')
}

async function find_scene_in_dir(
  dir: FileSystemDirectoryHandle,
): Promise<{ text: string; handle: FileSystemFileHandle; name: string } | undefined> {
  let fallback: { text: string; handle: FileSystemFileHandle; name: string } | undefined
  for await (const entry of dir.values()) {
    if (entry.kind === 'directory') {
      const found = await find_scene_in_dir(entry)
      if (found) {
        if (found.name.toLowerCase() === main_scene_file) {
          return found
        }
        fallback ??= found
      }
    } else if (entry.kind === 'file') {
      if (entry.name.toLowerCase() === main_scene_file) {
        const text = await (await entry.getFile()).text()
        return { text, handle: entry, name: entry.name }
      }
      if (!fallback && is_scene_file(entry.name)) {
        const text = await (await entry.getFile()).text()
        fallback = { text, handle: entry, name: entry.name }
      }
    }
  }
  return fallback
}

// Returns the file handle, text, and name of the main/initial scene.
// Checks:
// 1. Direct assets/main.scene.json
// 2. Any main.scene.json or *.scene.json recursively inside assets/ (e.g. assets/Scenes/main.scene.json)
// 3. Legacy scenes/main.scene.json (migrating it into assets/main.scene.json)
// 4. Fallback to writing a fresh empty scene in assets/main.scene.json
export async function get_main_scene(
  project: FileSystemDirectoryHandle,
): Promise<{ text: string; handle: FileSystemFileHandle; name: string }> {
  const assets_folder = await project.getDirectoryHandle('assets', { create: true })

  // 1. Direct assets/main.scene.json
  try {
    const handle = await assets_folder.getFileHandle(main_scene_file)
    const text = await (await handle.getFile()).text()
    return { text, handle, name: main_scene_file }
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'NotFoundError')) {
      throw error
    }
  }

  // 2. Search recursively in assets/
  const found_in_assets = await find_scene_in_dir(assets_folder)
  if (found_in_assets) {
    return found_in_assets
  }

  // 3. Migration: check if legacy scenes/main.scene.json exists
  try {
    const legacy_scenes = await project.getDirectoryHandle('scenes')
    const legacy_handle = await legacy_scenes.getFileHandle(main_scene_file)
    const text = await (await legacy_handle.getFile()).text()
    const handle = await assets_folder.getFileHandle(main_scene_file, { create: true })
    const writable = await handle.createWritable()
    await writable.write(text)
    await writable.close()
    return { text, handle, name: main_scene_file }
  } catch {
    // Legacy folder or file does not exist, proceed to create default empty scene
  }

  // 4. Create default empty scene in assets/main.scene.json
  const handle = await assets_folder.getFileHandle(main_scene_file, { create: true })
  const writable = await handle.createWritable()
  await writable.write(empty_scene)
  await writable.close()
  return { text: empty_scene, handle, name: main_scene_file }
}

export async function write_main_scene(
  project: FileSystemDirectoryHandle,
  text: string,
): Promise<FileSystemFileHandle> {
  const assets_folder = await project.getDirectoryHandle('assets', { create: true })
  const handle = await assets_folder.getFileHandle(main_scene_file, { create: true })
  const writable = await handle.createWritable()
  await writable.write(text)
  await writable.close()
  return handle
}

// Returns the text of the scene the game starts in.
export async function read_main_scene(project: FileSystemDirectoryHandle): Promise<string> {
  const { text } = await get_main_scene(project)
  return text
}
