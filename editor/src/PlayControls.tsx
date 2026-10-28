import { useState } from 'react'
import { launch_server, useServerStatus } from './network/server_status'
import { useAssetStore, useScriptStore } from './project/asset_store'
import { export_project_zip } from './project/export_project'
import { useProjectStore } from './project/project_store'
import { useSceneStore } from './project/scene_store'

export function PlayControls() {
  const playing = useSceneStore((store) => store.playing)
  const ready = useSceneStore((store) => store.document !== undefined)
  const play = useSceneStore((store) => store.play)
  const stop = useSceneStore((store) => store.stop)
  const document = useSceneStore((store) => store.document)
  const project = useProjectStore((store) => store.state)
  const { is_running } = useServerStatus()
  const [exporting, set_exporting] = useState(false)

  function start_server() {
    if (project.status !== 'open' || is_running) return
    launch_server(project.directory.name)
  }

  async function export_game() {
    if (project.status !== 'open' || exporting) return
    set_exporting(true)
    try {
      const asset_root = useAssetStore.getState().root
      const script_root = useScriptStore.getState().root
      await export_project_zip(project.directory, document, asset_root, script_root)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      useSceneStore.setState({ error: `Export failed: ${message}` })
    } finally {
      set_exporting(false)
    }
  }

  return (
    <div className="play-controls" role="toolbar" aria-label="Simulation">
      <button
        type="button"
        className="toolbar-button"
        aria-pressed={playing}
        disabled={!ready}
        title={playing ? 'Stop and restore the scene' : 'Simulate the scene; edits are paused until stopped'}
        onClick={playing ? stop : play}
      >
        {playing ? 'Stop' : 'Play'}
      </button>
      <button
        type="button"
        className="toolbar-button"
        aria-pressed={is_running}
        disabled={!ready || is_running}
        title={is_running ? '' : 'Start Server'}
        onClick={start_server}
      >
        {is_running ? 'Server Is Running' : 'Start Server'}
      </button>
      <button
        type="button"
        className="toolbar-button"
        disabled={!ready || playing || exporting}
        title="Export project to standalone Web bundle (.zip)"
        onClick={export_game}
      >
        {exporting ? 'Exporting...' : 'Export'}
      </button>
    </div>
  )
}
