import { launch_server, useServerStatus } from './network/server_status'
import { useProjectStore } from './project/project_store'
import { useSceneStore } from './project/scene_store'

export function PlayControls() {
  const playing = useSceneStore((store) => store.playing)
  const ready = useSceneStore((store) => store.document !== undefined)
  const play = useSceneStore((store) => store.play)
  const stop = useSceneStore((store) => store.stop)
  const project = useProjectStore((store) => store.state)
  const { is_running } = useServerStatus()

  function start_server() {
    if (project.status !== 'open' || is_running) return
    launch_server(project.directory.name)
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
    </div>
  )
}
