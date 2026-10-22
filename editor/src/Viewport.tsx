import { useEffect, useRef } from 'react'
import { load_engine } from './engine'

export function Viewport() {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvas.current) {
      load_engine(canvas.current).catch((error: unknown) => console.error('Seraphim failed to load', error))
    }
  }, [])

  return <canvas ref={canvas} id="seraphim-canvas" tabIndex={0} className="viewport" />
}
