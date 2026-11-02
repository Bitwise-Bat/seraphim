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

// Returns the file handle and text of the main scene.
// If assets/main.scene.json does not exist, it checks for legacy scenes/main.scene.json and migrates it.
// If neither exists, a fresh empty scene is written to assets/main.scene.json.
export async function get_main_scene(
  project: FileSystemDirectoryHandle,
): Promise<{ text: string; handle: FileSystemFileHandle }> {
  const assets_folder = await project.getDirectoryHandle('assets', { create: true })

  // 1. Try reading assets/main.scene.json
  try {
    const handle = await assets_folder.getFileHandle(main_scene_file)
    const text = await (await handle.getFile()).text()
    return { text, handle }
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'NotFoundError')) {
      throw error
    }
  }

  // 2. Migration: check if legacy scenes/main.scene.json exists
  try {
    const legacy_scenes = await project.getDirectoryHandle('scenes')
    const legacy_handle = await legacy_scenes.getFileHandle(main_scene_file)
    const text = await (await legacy_handle.getFile()).text()
    const handle = await assets_folder.getFileHandle(main_scene_file, { create: true })
    const writable = await handle.createWritable()
    await writable.write(text)
    await writable.close()
    return { text, handle }
  } catch {
    // Legacy folder or file does not exist, proceed to create default empty scene
  }

  // 3. Create default empty scene in assets/main.scene.json
  const handle = await assets_folder.getFileHandle(main_scene_file, { create: true })
  const writable = await handle.createWritable()
  await writable.write(empty_scene)
  await writable.close()
  return { text: empty_scene, handle }
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
