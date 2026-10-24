import * as esbuild from 'esbuild-wasm'
import esbuild_wasm_url from 'esbuild-wasm/esbuild.wasm?url'
import { files_in, type AssetFile, type AssetFolder } from '../project/assets'

let initialized: Promise<void> | undefined

const entry_path = '<entry>'
const entry_namespace = 'seraphim-entry'
const scripts_namespace = 'seraphim-scripts'

function dirname(path: string): string {
  const slash = path.lastIndexOf('/')
  return slash < 0 ? '' : path.slice(0, slash)
}

// Joins a relative import onto a folder inside scripts/; undefined when it climbs out of the folder.
function resolve_relative(folder: string, specifier: string): string | undefined {
  const parts = folder ? folder.split('/') : []
  for (const part of specifier.split('/')) {
    if (part === '..') {
      if (parts.length === 0) {
        return undefined
      }
      parts.pop()
    } else if (part !== '.' && part !== '') {
      parts.push(part)
    }
  }
  return parts.join('/')
}

function format_error(message: esbuild.Message): string {
  const location = message.location
  const file = location?.file.replace(`${scripts_namespace}:`, 'scripts/')
  const where = location ? `${file}:${location.line}:${location.column}: ` : ''
  return `${where}${message.text}`
}

function is_build_failure(error: unknown): error is esbuild.BuildFailure {
  return error instanceof Error && Array.isArray((error as Partial<esbuild.BuildFailure>).errors)
}

/**
 * Bundles the given scripts into one CommonJS module whose default export maps each script's asset id to its path
 * inside scripts/ and its default export. Imports between scripts are bundled in; 'seraphim' stays a require() call, so the host decides what it is.
 * Throws an Error listing every compile error.
 */
export async function compile_scripts(root: AssetFolder, scripts: AssetFile[]): Promise<string> {
  initialized ??= esbuild.initialize({ wasmURL: esbuild_wasm_url })
  await initialized

  const files = new Map([...files_in(root)].map((file) => [file.path, file]))
  const entry = [
    ...scripts.map((file, index) => `import script_${index} from ${JSON.stringify(`./${file.path}`)}`),
    `export default {${scripts
      .map((file, index) => `${JSON.stringify(file.id)}: { path: ${JSON.stringify(file.path)}, script: script_${index} }`)
      .join(', ')}}`,
  ].join('\n')

  const project_files: esbuild.Plugin = {
    name: 'seraphim-project-files',
    setup(build) {
      build.onResolve({ filter: /^seraphim$/ }, () => ({ path: 'seraphim', external: true }))
      build.onResolve({ filter: /.*/ }, ({ path, importer, namespace }) => {
        if (path === entry_path) {
          return { path, namespace: entry_namespace }
        }
        if (!path.startsWith('.')) {
          return { errors: [{ text: `Cannot import '${path}': scripts can only import 'seraphim' and other scripts` }] }
        }
        const base = resolve_relative(namespace === scripts_namespace ? dirname(importer) : '', path)
        // Like TypeScript's bundler resolution, imports may leave out the extension.
        const found = base === undefined ? undefined : [base, `${base}.ts`, `${base}.js`].find((c) => files.has(c))
        if (found === undefined) {
          return { errors: [{ text: `Cannot find '${path}' in the scripts folder` }] }
        }
        return { path: found, namespace: scripts_namespace }
      })
      build.onLoad({ filter: /.*/, namespace: entry_namespace }, () => ({ contents: entry, loader: 'js' }))
      build.onLoad({ filter: /.*/, namespace: scripts_namespace }, async ({ path }) => ({
        contents: await (await files.get(path)!.handle.getFile()).text(),
        loader: path.endsWith('.ts') ? 'ts' : 'js',
      }))
    },
  }

  try {
    const result = await esbuild.build({
      entryPoints: [entry_path],
      bundle: true,
      write: false,
      format: 'cjs',
      platform: 'neutral',
      target: 'es2023',
      // Lets browser dev tools show and step through the original TypeScript.
      sourcemap: 'inline',
      logLevel: 'silent',
      plugins: [project_files],
    })
    return result.outputFiles[0].text
  } catch (error) {
    if (is_build_failure(error)) {
      throw new Error(error.errors.map(format_error).join('\n'), { cause: error })
    }
    throw error
  }
}
