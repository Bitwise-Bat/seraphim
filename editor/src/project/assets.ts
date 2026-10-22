export type AssetFile = {
  id: string
  name: string
  path: string
  handle: FileSystemFileHandle
}

export type AssetFolder = {
  name: string
  path: string
  handle: FileSystemDirectoryHandle
  folders: AssetFolder[]
  files: AssetFile[]
}

type AssetMeta = {
  id: string
  version: number
}

export const assets_folder = 'assets'
const meta_suffix = '.meta'
const meta_version = 1

function join_path(folder: string, name: string): string {
  return folder ? `${folder}/${name}` : name
}

function by_name<T extends { name: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name, undefined, { numeric: true })
}

async function write_text(folder: FileSystemDirectoryHandle, name: string, text: string): Promise<void> {
  const writable = await (await folder.getFileHandle(name, { create: true })).createWritable()
  await writable.write(text)
  await writable.close()
}

async function write_meta(folder: FileSystemDirectoryHandle, file_name: string): Promise<AssetMeta> {
  const meta: AssetMeta = { id: crypto.randomUUID(), version: meta_version }
  await write_text(folder, file_name + meta_suffix, `${JSON.stringify(meta, null, 2)}\n`)
  return meta
}

async function read_meta(folder: FileSystemDirectoryHandle, file_name: string, path: string): Promise<AssetMeta> {
  const text = await (await (await folder.getFileHandle(file_name + meta_suffix)).getFile()).text()
  try {
    const meta = JSON.parse(text) as Partial<AssetMeta>
    if (typeof meta.id === 'string' && meta.version === meta_version) {
      return { id: meta.id, version: meta.version }
    }
  } catch {
    // Handled below like any other unreadable meta file.
  }
  // References to the old id cannot be recovered either way, so a fresh id keeps the asset usable.
  console.warn(`${path}${meta_suffix} is invalid; assigning a new asset id`)
  return write_meta(folder, file_name)
}

// Walks the folder, gives every asset a .meta file with a stable id and removes .meta files whose asset is gone.
export async function scan_folder(handle: FileSystemDirectoryHandle, path: string): Promise<AssetFolder> {
  const file_names: string[] = []
  const meta_names = new Set<string>()
  const folder_handles: FileSystemDirectoryHandle[] = []

  for await (const entry of handle.values()) {
    // Dotfiles are tool and OS clutter (.DS_Store, .gitkeep), not assets. Chromium writes files through a temporary
    // <name>.crswap file that only exists while a write is in progress.
    if (entry.name.startsWith('.') || entry.name.endsWith('.crswap')) {
      continue
    }
    if (entry.kind === 'directory') {
      folder_handles.push(entry)
    } else if (entry.name.endsWith(meta_suffix)) {
      meta_names.add(entry.name)
    } else {
      file_names.push(entry.name)
    }
  }

  const files: AssetFile[] = []
  for (const name of file_names) {
    const file_path = join_path(path, name)
    const meta_name = name + meta_suffix
    const meta = meta_names.has(meta_name) ? await read_meta(handle, name, file_path) : await write_meta(handle, name)
    meta_names.delete(meta_name)
    files.push({ id: meta.id, name, path: file_path, handle: await handle.getFileHandle(name) })
  }

  for (const orphan of meta_names) {
    await handle.removeEntry(orphan)
  }

  const folders: AssetFolder[] = []
  for (const folder of folder_handles) {
    folders.push(await scan_folder(folder, join_path(path, folder.name)))
  }

  return { name: handle.name, path, handle, folders: folders.sort(by_name), files: files.sort(by_name) }
}

function unique_name(name: string, taken: Set<string>): string {
  if (!taken.has(name)) {
    return name
  }
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const extension = dot > 0 ? name.slice(dot) : ''
  for (let copy = 1; ; ++copy) {
    const candidate = `${stem} (${copy})${extension}`
    if (!taken.has(candidate)) {
      return candidate
    }
  }
}

export async function import_files(folder: FileSystemDirectoryHandle, files: File[]): Promise<void> {
  const taken = await names_in(folder)
  for (const file of files) {
    const name = unique_name(file.name, taken)
    taken.add(name)
    const writable = await (await folder.getFileHandle(name, { create: true })).createWritable()
    await writable.write(file)
    await writable.close()
    await write_meta(folder, name)
  }
}

export type AssetEntry = { kind: 'file' | 'directory'; name: string }

async function names_in(folder: FileSystemDirectoryHandle): Promise<Set<string>> {
  const names = new Set<string>()
  for await (const name of folder.keys()) {
    names.add(name)
  }
  return names
}

// Returns why the name cannot be used, or undefined when it is valid.
export function validate_asset_name(name: string): string | undefined {
  if (!name.trim()) {
    return 'The name cannot be empty'
  }
  if (/[\\/:*?"<>|]/.test(name)) {
    return 'The name cannot contain \\ / : * ? " < > |'
  }
  if (name.startsWith('.')) {
    return 'The name cannot start with a dot'
  }
  if (name.endsWith(meta_suffix) || name.endsWith('.crswap')) {
    return `The name cannot end with ${meta_suffix} or .crswap`
  }
  return undefined
}

async function copy_file(source: FileSystemFileHandle, target: FileSystemDirectoryHandle, name: string): Promise<void> {
  const writable = await (await target.getFileHandle(name, { create: true })).createWritable()
  await writable.write(await source.getFile())
  await writable.close()
}

async function copy_folder(source: FileSystemDirectoryHandle, target: FileSystemDirectoryHandle): Promise<void> {
  for await (const entry of source.values()) {
    if (entry.kind === 'file') {
      await copy_file(entry, target, entry.name)
    } else {
      await copy_folder(entry, await target.getDirectoryHandle(entry.name, { create: true }))
    }
  }
}

// Copies and then deletes, since FileSystemHandle.move() is not available for every kind of folder. The .meta file
// moves along, so the asset keeps its id and references to it stay valid.
export async function rename_entry(folder: FileSystemDirectoryHandle, entry: AssetEntry, new_name: string): Promise<void> {
  const problem = validate_asset_name(new_name)
  if (problem) {
    throw new Error(problem)
  }
  if (new_name === entry.name) {
    return
  }
  if ((await names_in(folder)).has(new_name)) {
    throw new Error(`${new_name} already exists in this folder`)
  }

  if (entry.kind === 'directory') {
    const target = await folder.getDirectoryHandle(new_name, { create: true })
    await copy_folder(await folder.getDirectoryHandle(entry.name), target)
    await folder.removeEntry(entry.name, { recursive: true })
    return
  }

  await copy_file(await folder.getFileHandle(entry.name), folder, new_name)
  await copy_file(await folder.getFileHandle(entry.name + meta_suffix), folder, new_name + meta_suffix)
  await folder.removeEntry(entry.name)
  await folder.removeEntry(entry.name + meta_suffix)
}

export async function delete_entry(folder: FileSystemDirectoryHandle, entry: AssetEntry): Promise<void> {
  if (entry.kind === 'directory') {
    await folder.removeEntry(entry.name, { recursive: true })
    return
  }
  await folder.removeEntry(entry.name)
  await folder.removeEntry(entry.name + meta_suffix)
}

export function find_folder(root: AssetFolder, path: string): AssetFolder | undefined {
  if (root.path === path) {
    return root
  }
  for (const folder of root.folders) {
    if (path === folder.path || path.startsWith(`${folder.path}/`)) {
      return find_folder(folder, path)
    }
  }
  return undefined
}
