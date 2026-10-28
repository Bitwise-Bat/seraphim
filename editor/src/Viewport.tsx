import { useEffect, useRef, useState } from 'react'
import type { MainModule } from 'seraphim/seraphim.js'
import { ColliderOutlines } from './ColliderOutlines'
import { load_engine } from './engine'
import { Gizmo } from './Gizmo'
import { Performance } from './Performance'
import { PlayControls } from './PlayControls'
import { useAssetStore } from './project/asset_store'
import { sync_engine_assets } from './project/engine_assets'
import { useSceneStore } from './project/scene_store'
import { useTilemapPainting } from './tilemap_painting'
import { useCamera } from './viewport_camera'
import { useViewportDrag } from './viewport_drag'
import { ViewportOverlay } from './ViewportOverlay'

export function Viewport({ project }: { project: FileSystemDirectoryHandle }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [engine, set_engine] = useState<MainModule>()
  const assets = useAssetStore((store) => store.root)
  const open_scene = useSceneStore((store) => store.open)
  const playing = useSceneStore((store) => store.playing)

  useEffect(() => {
    if (canvas.current) {
      load_engine(canvas.current)
        .then(set_engine)
        .catch((error: unknown) => console.error('Seraphim failed to load', error))
    }
  }, [])

  useEffect(() => {
    if (engine && assets) {
      sync_engine_assets(engine, assets).catch((error: unknown) => console.error('Asset sync failed', error))
    }
  }, [engine, assets])

  useEffect(() => {
    if (engine) {
      void open_scene(project, engine)
    }
  }, [engine, project, open_scene])

  useViewportDrag(canvas, engine)
  useCamera(canvas, engine)
  useTilemapPainting(canvas, engine)

  useEffect(() => {
    if (!canvas.current) {
      return
    }
    // SDL only resizes the canvas backing store on window resize events, so panel resizes are forwarded as one.
    const observer = new ResizeObserver(() => window.dispatchEvent(new Event('resize')))
    observer.observe(canvas.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="viewport">
      <canvas ref={canvas} id="seraphim-canvas" tabIndex={0} className="viewport-canvas" />
      {playing &&  <div className="seraphim-ui" id="seraphim-ui"></div>}
      {!playing && <ColliderOutlines canvas_ref={canvas} />}
      {!playing && <Gizmo canvas_ref={canvas} />}
      <Performance />
      <PlayControls />
      <ViewportOverlay canvas_ref={canvas} />

    </div>
  )
}
