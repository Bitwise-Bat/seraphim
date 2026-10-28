import { useEffect, type RefObject } from 'react'
import type { MainModule } from 'seraphim/seraphim.js'
import { useCameraStore } from './camera_store'
import { useSceneStore } from './project/scene_store'

// Each wheel notch scales the view by the same factor, so zooming feels equally fast at every distance.
const zoom_step = 1.1
const view_height_limits = { min: 0.5, max: 1000 }
const pan_buttons = new Set([1, 2])

// Pans with the middle or right mouse button and zooms around the cursor with the wheel.
export function useCamera(canvas_ref: RefObject<HTMLCanvasElement | null>, engine: MainModule | undefined) {
  // Scripts may move the camera while the scene plays, so the editor keeps its hands off it until play stops.
  const playing = useSceneStore((store) => store.playing)

  // Attach engine to camera store once when engine is loaded (does not re-attach on play)
  useEffect(() => {
    if (engine) {
      useCameraStore.getState().attach(engine)
    }
  }, [engine])

  useEffect(() => {
    const canvas = canvas_ref.current
    if (!canvas) {
      return
    }
    const { set_camera } = useCameraStore.getState()
    // Only the height matters: the camera maps view_height world units onto the canvas height.
    const units_per_css_pixel = (view_height: number) => view_height / canvas.getBoundingClientRect().height
    let panning = false

    function on_pointer_down(event: PointerEvent) {
      if (!canvas || !pan_buttons.has(event.button)) {
        return
      }
      // Stops the middle button from starting the browser's autoscroll.
      event.preventDefault()
      panning = true
      canvas.setPointerCapture(event.pointerId)
    }

    function on_pointer_move(event: PointerEvent) {
      if (!panning || playing) {
        return
      }
      const { position, view_height } = useCameraStore.getState()
      const scale = units_per_css_pixel(view_height)
      // Dragging moves the world with the pointer, so the camera goes the other way; screen y points down.
      set_camera({ x: position.x - event.movementX * scale, y: position.y + event.movementY * scale }, view_height)
    }

    function end_pan() {
      panning = false
    }

    function on_wheel(event: WheelEvent) {
      if (!canvas || playing) {
        return
      }
      event.preventDefault()
      const camera = useCameraStore.getState()
      const factor = event.deltaY > 0 ? zoom_step : 1 / zoom_step
      const view_height = Math.min(
        view_height_limits.max,
        Math.max(view_height_limits.min, camera.view_height * factor),
      )
      // Shifting by the cursor's offset from the center keeps the world point under the cursor in place.
      const rect = canvas.getBoundingClientRect()
      const offset_x = event.clientX - rect.left - rect.width / 2
      const offset_y = rect.height / 2 - (event.clientY - rect.top)
      const shift = units_per_css_pixel(camera.view_height) - units_per_css_pixel(view_height)
      set_camera({ x: camera.position.x + offset_x * shift, y: camera.position.y + offset_y * shift }, view_height)
    }

    // The right button pans, so its menu would get in the way.
    function on_context_menu(event: MouseEvent) {
      event.preventDefault()
    }

    canvas.addEventListener('pointerdown', on_pointer_down)
    canvas.addEventListener('pointermove', on_pointer_move)
    canvas.addEventListener('pointerup', end_pan)
    canvas.addEventListener('pointercancel', end_pan)
    // Passive wheel listeners cannot stop the page from scrolling.
    canvas.addEventListener('wheel', on_wheel, { passive: false })
    canvas.addEventListener('contextmenu', on_context_menu)
    return () => {
      canvas.removeEventListener('pointerdown', on_pointer_down)
      canvas.removeEventListener('pointermove', on_pointer_move)
      canvas.removeEventListener('pointerup', end_pan)
      canvas.removeEventListener('pointercancel', end_pan)
      canvas.removeEventListener('wheel', on_wheel)
      canvas.removeEventListener('contextmenu', on_context_menu)
    }
  }, [canvas_ref, playing])
}
