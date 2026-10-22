const scenes_folder = 'scenes'
const main_scene_file = 'main.scene.json'
const empty_scene = `${JSON.stringify({ format_version: 1, entities: [] }, null, 2)}\n`

// Returns the text of the scene the game starts in. Projects created before scenes existed have none, so an empty one
// is written for them.
export async function read_main_scene(project: FileSystemDirectoryHandle): Promise<string> {
  const folder = await project.getDirectoryHandle(scenes_folder, { create: true })
  try {
    return await (await (await folder.getFileHandle(main_scene_file)).getFile()).text()
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'NotFoundError')) {
      throw error
    }
  }
  const writable = await (await folder.getFileHandle(main_scene_file, { create: true })).createWritable()
  await writable.write(empty_scene)
  await writable.close()
  return empty_scene
}
