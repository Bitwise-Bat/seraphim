import { useEffect, type RefObject } from 'react'
import type { MainModule } from 'seraphim/seraphim.js'
import type { Vec2 } from './project/scene_document'
import { useSceneStore } from './project/scene_store'
import { painted_entity } from './tilemap_tool_store'

type ActiveDrag = {
  id: string
  // Keeps the point that was grabbed under the pointer instead of snapping the entity's center to it.
  grab_offset: Vec2
}

// The engine works in backing store pixels, which differ from CSS pixels on high-DPI screens.
function canvas_pixel(canvas: HTMLCanvasElement, event: PointerEvent): Vec2 {
  const rect = canvas.getBoundingClientRect()
  return [
    ((event.clientX - rect.left) * canvas.width) / rect.width,
    ((event.clientY - rect.top) * canvas.height) / rect.height,
  ]
}

export function world_at(engine: MainModule, canvas: HTMLCanvasElement, event: PointerEvent): Vec2 | undefined {
  const world = engine.Engine.screen_to_world(...canvas_pixel(canvas, event)) as { x: number; y: number } | null
  return world ? [world.x, world.y] : undefined
}

// Clicking a sprite in the viewport selects its entity; dragging moves it. Clicking empty space clears the selection.
export function useViewportDrag(canvas_ref: RefObject<HTMLCanvasElement | null>, engine: MainModule | undefined) {
  useEffect(() => {
    const canvas = canvas_ref.current
    if (!canvas || !engine) {
      return
    }
    let active: ActiveDrag | undefined

    function on_pointer_down(event: PointerEvent) {
      if (!canvas || !engine || event.button !== 0 || painted_entity()) {
        return
      }
      const { document, select } = useSceneStore.getState()
      const id = engine.Engine.pick_entity(...canvas_pixel(canvas, event))
      select(id || undefined)

      const position = document?.entities.find((entity) => entity.id === id)?.components.transform?.position
      const world = world_at(engine, canvas, event)
      if (!position || !world) {
        return
      }
      active = { id, grab_offset: [position[0] - world[0], position[1] - world[1]] }
      // Capture keeps the drag going when the pointer leaves the canvas.
      canvas.setPointerCapture(event.pointerId)
    }

    function on_pointer_move(event: PointerEvent) {
      if (!canvas || !engine || !active) {
        return
      }
      const world = world_at(engine, canvas, event)
      if (!world) {
        return
      }
      const { id, grab_offset } = active
      const position: Vec2 = [world[0] + grab_offset[0], world[1] + grab_offset[1]]
      useSceneStore.getState().update_entity(id, (entity) =>
        entity.components.transform
          ? { ...entity, components: { ...entity.components, transform: { ...entity.components.transform, position } } }
          : entity,
      )
    }

    function end_drag() {
      active = undefined
    }

    canvas.addEventListener('pointerdown', on_pointer_down)
    canvas.addEventListener('pointermove', on_pointer_move)
    canvas.addEventListener('pointerup', end_drag)
    canvas.addEventListener('pointercancel', end_drag)
    return () => {
      canvas.removeEventListener('pointerdown', on_pointer_down)
      canvas.removeEventListener('pointermove', on_pointer_move)
      canvas.removeEventListener('pointerup', end_drag)
      canvas.removeEventListener('pointercancel', end_drag)
    }
  }, [canvas_ref, engine])
}
