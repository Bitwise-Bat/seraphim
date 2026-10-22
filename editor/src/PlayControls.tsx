import { useSceneStore } from './project/scene_store'

export function PlayControls() {
  const playing = useSceneStore((store) => store.playing)
  const ready = useSceneStore((store) => store.document !== undefined)
  const play = useSceneStore((store) => store.play)
  const stop = useSceneStore((store) => store.stop)

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
    </div>
  )
}
