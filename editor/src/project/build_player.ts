import * as esbuild from 'esbuild-wasm'
import { ensure_esbuild } from '../scripting/compile.ts'
import keys_source from '../scripting/keys.ts?raw'
import seraphim_api_source from '../scripting/seraphim_api.ts?raw'
import script_host_source from '../../../runtime/script_host.ts?raw'
import world_api_source from '../../../runtime/world_api.ts?raw'
import player_entry_source from './player_entry.ts?raw'

export async function build_player_bundle(): Promise<string> {
  await ensure_esbuild()

  const files: Record<string, string> = {
    '/player_entry.ts': `import create_seraphim from './seraphim.js';\n${player_entry_source}`,
    '/runtime/script_host.ts': script_host_source,
    '/runtime/world_api.ts': world_api_source,
    '/editor/seraphim_api.ts': seraphim_api_source,
    '/editor/keys.ts': keys_source,
    '/editor/server_connection.ts': 'export type ServerConnection = any;',
  }

  const vfs_plugin: esbuild.Plugin = {
    name: 'player-vfs',
    setup(build) {
      build.onResolve({ filter: /^\.\/seraphim\.js$/ }, () => ({
        path: './seraphim.js',
        external: true,
      }))
      build.onResolve({ filter: /seraphim/ }, (args) => {
        if (args.path.endsWith('.js') || args.path === 'seraphim') {
          return { path: './seraphim.js', external: true }
        }
        return undefined
      })
      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.path === '/player_entry.ts') {
          return { path: '/player_entry.ts' }
        }
        if (args.path.includes('script_host')) {
          return { path: '/runtime/script_host.ts' }
        }
        if (args.path.includes('world_api')) {
          return { path: '/runtime/world_api.ts' }
        }
        if (args.path.includes('seraphim_api')) {
          return { path: '/editor/seraphim_api.ts' }
        }
        if (args.path.includes('keys')) {
          return { path: '/editor/keys.ts' }
        }
        if (args.path.includes('server_connection')) {
          return { path: '/editor/server_connection.ts' }
        }
        return { path: args.path }
      })
      build.onLoad({ filter: /.*/ }, (args) => {
        const contents = files[args.path]
        if (contents !== undefined) {
          return { contents, loader: 'ts' }
        }
        return { contents: '', loader: 'ts' }
      })
    },
  }

  const result = await esbuild.build({
    entryPoints: ['/player_entry.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2023',
    minify: true,
    plugins: [vfs_plugin],
  })

  return result.outputFiles[0].text
}
