import { useEffect, useRef, useState } from 'react'
import type { MainModule } from 'seraphim/seraphim.js'
import { load_engine } from './engine'
import { useAssetStore } from './project/asset_store'
import { sync_engine_assets } from './project/engine_assets'

export function Viewport() {
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
