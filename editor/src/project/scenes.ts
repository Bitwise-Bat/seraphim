const scenes_folder = 'scenes'
export const main_scene_file = 'main.scene.json'
const empty_scene = `${JSON.stringify({ format_version: 1, entities: [] }, null, 2)}\n`

async function scenes(project: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  return project.getDirectoryHandle(scenes_folder, { create: true })
}

export async function write_main_scene(project: FileSystemDirectoryHandle, text: string): Promise<void> {
  const writable = await (await (await scenes(project)).getFileHandle(main_scene_file, { create: true })).createWritable()
  await writable.write(text)
  await writable.close()
}

// Returns the text of the scene the game starts in. Projects created before scenes existed have none, so an empty one
// is written for them.
export async function read_main_scene(project: FileSystemDirectoryHandle): Promise<string> {
  try {
    return await (await (await (await scenes(project)).getFileHandle(main_scene_file)).getFile()).text()
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'NotFoundError')) {
      throw error
    }
  }
  await write_main_scene(project, empty_scene)
  return empty_scene
}
