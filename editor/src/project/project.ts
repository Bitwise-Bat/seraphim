import { script_tsconfig, script_types } from './scripts'

export type ProjectManifest = {
  format_version: number
  name: string
}

const manifest_file = 'project.json'
const current_format_version = 1
const project_folders = ['assets', 'scripts', 'scenes']
// The editor keeps generated files such as compiled scripts in .seraphim/, which never belongs in version control.
const generated_folder = '.seraphim'
const gitignore = `${generated_folder}/\n`

async function file_exists(directory: FileSystemDirectoryHandle, name: string): Promise<boolean> {
  try {
    await directory.getFileHandle(name)
    return true
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') {
      return false
    }
    throw error
  }
}

async function write_text(directory: FileSystemDirectoryHandle, name: string, text: string): Promise<void> {
  const file = await directory.getFileHandle(name, { create: true })
  const writable = await file.createWritable()
  await writable.write(text)
  await writable.close()
}

function parse_manifest(text: string): ProjectManifest {
  const value: unknown = JSON.parse(text)
  if (typeof value !== 'object' || value === null) {
    throw new Error(`${manifest_file} is not a JSON object`)
  }
  const { format_version, name } = value as Record<string, unknown>
  if (format_version !== current_format_version) {
    throw new Error(`${manifest_file} has format version ${String(format_version)}, expected ${current_format_version}`)
  }
  if (typeof name !== 'string') {
    throw new Error(`${manifest_file} has no project name`)
  }
  return { format_version, name }
}

export async function create_project(directory: FileSystemDirectoryHandle): Promise<ProjectManifest> {
  if (await file_exists(directory, manifest_file)) {
    throw new Error('This folder already contains a Seraphim project')
  }

  for (const folder of project_folders) {
    await directory.getDirectoryHandle(folder, { create: true })
  }
  if (!(await file_exists(directory, '.gitignore'))) {
    await write_text(directory, '.gitignore', gitignore)
  }

  const manifest: ProjectManifest = { format_version: current_format_version, name: directory.name }
  await write_text(directory, manifest_file, `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

// Lets code editors resolve and type-check imports of the engine API. The tsconfig is only created when missing, since
// the user may tune it.
export async function write_script_setup(directory: FileSystemDirectoryHandle): Promise<void> {
  const generated = await directory.getDirectoryHandle(generated_folder, { create: true })
  const types = await generated.getDirectoryHandle(script_types.folder, { create: true })
  await write_text(types, script_types.name, script_types.contents)
  if (!(await file_exists(directory, script_tsconfig.name))) {
    await write_text(directory, script_tsconfig.name, script_tsconfig.contents)
  }
}

// Holds the server's scripts as the last Play compiled them.
export async function write_server_bundle(directory: FileSystemDirectoryHandle, code: string): Promise<void> {
  const generated = await directory.getDirectoryHandle(generated_folder, { create: true })
  await write_text(generated, 'server.js', code)
}

export async function read_project(directory: FileSystemDirectoryHandle): Promise<ProjectManifest> {
  if (!(await file_exists(directory, manifest_file))) {
    throw new Error(`This folder is not a Seraphim project: ${manifest_file} is missing`)
  }
  const file = await (await directory.getFileHandle(manifest_file)).getFile()
  return parse_manifest(await file.text())
}
