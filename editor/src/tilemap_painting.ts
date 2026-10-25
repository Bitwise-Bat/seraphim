import { useEffect, type RefObject } from 'react'
import type { MainModule } from 'seraphim/seraphim.js'
import { useSceneStore } from './project/scene_store'
import { cell_at, cells_between, flood_fill, paint_cells, paint_stamp, type Cell } from './project/tilemap'
import { painted_entity, useTilemapToolStore } from './tilemap_tool_store'
import { world_at } from './viewport_drag'

function deduplicate(cells: Cell[]): Cell[] {
  const seen = new Set<string>()
  return cells.filter(([x, y]) => {
    const key = `${x},${y}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

// Paints the selected entity's tilemap with the chosen tool while the left button is held over the viewport.
export function useTilemapPainting(canvas_ref: RefObject<HTMLCanvasElement | null>, engine: MainModule | undefined) {
  useEffect(() => {
    const canvas = canvas_ref.current
    if (!canvas || !engine) {
      return
    }
    let origin: Cell | undefined
    let last: Cell | undefined
    let stroking = false

    function cell_under(event: PointerEvent): Cell | undefined {
      const painted = painted_entity()
      const world = canvas && engine ? world_at(engine, canvas, event) : undefined
      return painted && world ? cell_at(painted.tilemap, painted.transform, world) : undefined
    }

    // A brush stroke lays its stamps on a grid of the stamp's size that starts where the stroke began, so a large
    // stamp is placed side by side instead of smeared over itself.
    function snapped(cell: Cell): Cell {
      const { tool, stamp } = useTilemapToolStore.getState()
      if (tool !== 'brush' || !origin) {
        return cell
      }
      return [
        origin[0] + Math.floor((cell[0] - origin[0]) / stamp.width) * stamp.width,
        origin[1] + Math.floor((cell[1] - origin[1]) / stamp.height) * stamp.height,
      ]
    }

    function apply(cells: Cell[]) {
      const painted = painted_entity()
      if (!painted) {
        return
      }
      const { tool, stamp, layer } = useTilemapToolStore.getState()
      useSceneStore.getState().update_entity(painted.id, (entity) => {
        const { tilemap } = entity.components
        if (!tilemap) {
          return entity
        }
        // Clamped like the inspector's layer list, which shows the last layer when the stored one is gone.
        const painted_layer = Math.min(layer, tilemap.layers.length - 1)
        const painted_map =
          tool === 'fill'
            ? flood_fill(tilemap, painted_layer, cells[0], stamp)
            : tool === 'eraser'
              ? paint_cells(tilemap, painted_layer, cells, 0)
              : paint_stamp(tilemap, painted_layer, cells, stamp)
        return { ...entity, components: { ...entity.components, tilemap: painted_map } }
      })
    }

    function on_pointer_down(event: PointerEvent) {
      if (!canvas || event.button !== 0 || !painted_entity()) {
        return
      }
      stroking = useTilemapToolStore.getState().tool !== 'fill'
      canvas.setPointerCapture(event.pointerId)
      origin = cell_under(event)
      last = origin
      if (last) {
        apply([last])
      }
    }

    function on_pointer_move(event: PointerEvent) {
      if (!stroking) {
        return
      }
      const under = cell_under(event)
      if (!under) {
        return
      }
      // A stroke that started outside the map begins its stamp grid where it first enters it.
      origin ??= under
      const cell = snapped(under)
      if (last && cell[0] === last[0] && cell[1] === last[1]) {
        return
      }
      apply(deduplicate(last ? cells_between(last, cell).map(snapped) : [cell]))
      last = cell
    }

    function end_stroke() {
      stroking = false
      origin = undefined
      last = undefined
    }

    canvas.addEventListener('pointerdown', on_pointer_down)
    canvas.addEventListener('pointermove', on_pointer_move)
    canvas.addEventListener('pointerup', end_stroke)
    canvas.addEventListener('pointercancel', end_stroke)
    return () => {
      canvas.removeEventListener('pointerdown', on_pointer_down)
      canvas.removeEventListener('pointermove', on_pointer_move)
      canvas.removeEventListener('pointerup', end_stroke)
      canvas.removeEventListener('pointercancel', end_stroke)
    }
  }, [canvas_ref, engine])
}
