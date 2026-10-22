import { useEffect, useState, type RefObject } from 'react'
import { useCameraStore } from './camera_store'

type Cursor = {
  // Offset from the canvas center in CSS pixels, with y pointing up like the world.
  x: number
  y: number
  canvas_height: number
}

// Shows the camera and the world position under the cursor. Kept apart from the viewport so pointer moves only
// re-render this label.
export function ViewportOverlay({ canvas_ref }: { canvas_ref: RefObject<HTMLCanvasElement | null> }) {
  const position = useCameraStore((store) => store.position)
  const view_height = useCameraStore((store) => store.view_height)
  const [cursor, set_cursor] = useState<Cursor>()

  useEffect(() => {
    const canvas = canvas_ref.current
    if (!canvas) {
      return
    }
    function on_pointer_move(event: PointerEvent) {
      if (!canvas) {
        return
      }
      const rect = canvas.getBoundingClientRect()
      set_cursor({
        x: event.clientX - rect.left - rect.width / 2,
        y: rect.height / 2 - (event.clientY - rect.top),
        canvas_height: rect.height,
      })
    }
    function on_pointer_leave() {
      set_cursor(undefined)
    }
    canvas.addEventListener('pointermove', on_pointer_move)
    canvas.addEventListener('pointerleave', on_pointer_leave)
    return () => {
      canvas.removeEventListener('pointermove', on_pointer_move)
      canvas.removeEventListener('pointerleave', on_pointer_leave)
    }
  }, [canvas_ref])

  // Derived from the current camera instead of stored, so it stays right while zooming without moving the pointer.
  const units_per_pixel = cursor ? view_height / cursor.canvas_height : 0
  const world = cursor && { x: position.x + cursor.x * units_per_pixel, y: position.y + cursor.y * units_per_pixel }

  return (
    <output className="viewport-overlay" aria-label="Camera">
      x {position.x.toFixed(2)} y {position.y.toFixed(2)} height {view_height.toFixed(2)}
      {world && ` | cursor ${world.x.toFixed(2)}, ${world.y.toFixed(2)}`}
    </output>
  )
}
