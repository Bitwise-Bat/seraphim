import { useEffect, useRef, useState } from 'react'
import type { MainModule } from 'seraphim/seraphim.js'
import { load_engine } from './engine'
import { useAssetStore } from './project/asset_store'
import { sync_engine_assets } from './project/engine_assets'
import { read_main_scene } from './project/scenes'

export function Viewport({ project }: { project: FileSystemDirectoryHandle }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [engine, set_engine] = useState<MainModule>()
  const assets = useAssetStore((store) => store.root)

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
    if (!engine) {
      return
    }
    read_main_scene(project)
      .then((scene) => {
        const problem = engine.Engine.load_scene(scene)
        if (problem) {
          console.error(`The main scene could not be loaded: ${problem}`)
        }
      })
      .catch((error: unknown) => console.error('Reading the main scene failed', error))
  }, [engine, project])

  useEffect(() => {
    if (!canvas.current) {
      return
    }
    // SDL only resizes the canvas backing store on window resize events, so panel resizes are forwarded as one.
    const observer = new ResizeObserver(() => window.dispatchEvent(new Event('resize')))
    observer.observe(canvas.current)
    return () => observer.disconnect()
  }, [])

  return <canvas ref={canvas} id="seraphim-canvas" tabIndex={0} className="viewport" />
}
