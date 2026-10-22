import { useEffect, useRef } from 'react'
import { load_engine } from './engine'

export function Viewport() {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvas.current) {
      load_engine(canvas.current).catch((error: unknown) => console.error('Seraphim failed to load', error))
    }
  }, [])

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
