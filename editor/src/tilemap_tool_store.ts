import { create } from 'zustand'
import type { Stamp } from './project/tilemap'
import { useSceneStore } from './project/scene_store'

// Select leaves viewport clicks to picking and dragging; the others paint the selected entity's tilemap.
export type TilemapTool = 'select' | 'brush' | 'eraser' | 'fill'

type TilemapToolStore = {
  tool: TilemapTool
  // The palette's last picked tile, where shift-click selections start; tiles count from 1 in the tileset's reading
  // order.
  tile: number
  // Index of the layer that is painted.
  layer: number
  stamp: Stamp
  palette_zoom: number
  set_tool: (tool: TilemapTool) => void
  set_tile: (tile: number) => void
  set_layer: (layer: number) => void
  set_stamp: (stamp: Stamp) => void
  set_palette_zoom: (palette_zoom: number) => void
}

export const useTilemapToolStore = create<TilemapToolStore>()((set) => ({
  tool: 'select',
  tile: 1,
  layer: 0,
  palette_zoom: 1,
  stamp: { width: 1, height: 1, tiles: [1] },
  set_tool: (tool) => set({ tool }),
  set_tile: (tile) => set({ tile }),
  set_layer: (layer) => set({ layer }),
  set_stamp: (stamp) => set({ stamp }),
  set_palette_zoom: (palette_zoom) => set({ palette_zoom }),
}))

// The entity the viewport paints on: set while a paint tool is chosen and the selected entity has a tilemap, so
// clicks paint instead of picking.
export function painted_entity() {
  if (useTilemapToolStore.getState().tool === 'select') {
    return undefined
  }
  const { document, selected, playing } = useSceneStore.getState()
  const entity = playing ? undefined : document?.entities.find((candidate) => candidate.id === selected)
  const { tilemap, transform } = entity?.components ?? {}
  return entity && tilemap && transform ? { id: entity.id, tilemap, transform } : undefined
}
