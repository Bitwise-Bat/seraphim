import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { find_file_by_id, type AssetFile } from './project/assets'
import { useAssetStore } from './project/asset_store'
import { is_tileset_name, type Stamp } from './project/tilemap'
import { useTilemapToolStore } from './tilemap_tool_store'

// The part of the *.tileset.json format the palette needs; the engine validates the rest.
type TilesetFile = {
  texture: string
  tile_size: [number, number]
  spacing?: number
  margin?: number
}

type LoadedTileset = {
  // Results for a tileset that is no longer shown are ignored instead of cleared.
  source: AssetFile
  file?: TilesetFile
  // Object URL of the tileset's texture.
  url?: string
  problem?: string
}

type Grid = {
  columns: number
  rows: number
  margin: number
  stride_x: number
  stride_y: number
}

// Mirrors asset::tileset::uv_rect, so the palette numbers tiles the way the engine draws them.
function grid_of(file: TilesetFile, width: number, height: number): Grid {
  const margin = file.margin ?? 0
  const spacing = file.spacing ?? 0
  const [tile_width, tile_height] = file.tile_size
  const stride_x = tile_width + spacing
  const stride_y = tile_height + spacing
  return {
    columns: Math.max(0, Math.floor((width - 2 * margin + spacing) / stride_x)),
    rows: Math.max(0, Math.floor((height - 2 * margin + spacing) / stride_y)),
    margin,
    stride_x,
    stride_y,
  }
}

function is_tileset_file(value: unknown): value is TilesetFile {
  const file = value as Partial<TilesetFile> | null
  return (
    typeof file?.texture === 'string' &&
    Array.isArray(file.tile_size) &&
    file.tile_size.length === 2 &&
    file.tile_size.every((size) => typeof size === 'number' && size > 0)
  )
}

// Packs tiles into the smallest rectangle of the tileset that holds them; cells left out of the selection stay 0.
function stamp_of(tiles: number[], columns: number): Stamp {
  const cells = tiles.map((tile) => [(tile - 1) % columns, Math.floor((tile - 1) / columns)] as const)
  const left = Math.min(...cells.map(([x]) => x))
  const top = Math.min(...cells.map(([, y]) => y))
  const width = Math.max(...cells.map(([x]) => x)) - left + 1
  const height = Math.max(...cells.map(([, y]) => y)) - top + 1
  const stamp_tiles = Array<number>(width * height).fill(0)
  cells.forEach(([x, y], i) => {
    stamp_tiles[(y - top) * width + (x - left)] = tiles[i]
  })
  return { width, height, tiles: stamp_tiles }
}

// Shows the tileset's image cut into its tiles; clicking a tile picks it for the brush.
export function TilePalette({ tileset }: { tileset: string }) {
  const root = useAssetStore((store) => store.root)
  const tile = useTilemapToolStore((store) => store.tile)
  const tool = useTilemapToolStore((store) => store.tool)
  const palette_zoom = useTilemapToolStore((store) => store.palette_zoom)
  const stamp = useTilemapToolStore((store) => store.stamp)
  const { set_tile, set_tool, set_palette_zoom, set_stamp } = useTilemapToolStore.getState()
  const [result, set_result] = useState<LoadedTileset>()
  const [image, set_image] = useState<{ url: string; width: number; height: number }>()
  const dragging_ref = useRef<{ origin: [number, number] } | null>(null)
  const tileset_file = root && tileset ? find_file_by_id(root, tileset) : undefined
  
  useEffect(() => {
    if (!root || !tileset_file) {
      return
    }
    let url: string | undefined
    let cancelled = false
    void (async () => {
      const parsed: unknown = JSON.parse(await (await tileset_file.handle.getFile()).text())
      if (!is_tileset_file(parsed)) {
        throw new Error('The tileset needs a texture and a tile_size')
      }
      const texture = find_file_by_id(root, parsed.texture)
      if (!texture) {
        throw new Error(`The tileset's texture ${parsed.texture} is missing`)
      }
      const blob = await texture.handle.getFile()
      if (!cancelled) {
        url = URL.createObjectURL(blob)
        set_result({ source: tileset_file, file: parsed, url })
      }
    })().catch((error: unknown) => {
      if (!cancelled) {
        set_result({ source: tileset_file, problem: error instanceof Error ? error.message : String(error) })
      }
    })
    return () => {
      cancelled = true
      if (url) {
        URL.revokeObjectURL(url)
      }
    }
  }, [root, tileset_file])

  if (!tileset) {
    return <p className="panel-hint">Drop a tileset to paint with it.</p>
  }
  if (!tileset_file) {
    return <p className="panel-hint">Missing tileset {tileset}</p>
  }
  // Fields set before the drop check existed, or edited by hand, can still point at another kind of file.
  if (!is_tileset_name(tileset_file.name)) {
    return <p className="panel-hint">{tileset_file.name} is not a tileset; drop a .tileset.json file instead.</p>
  }
  const loaded = result?.source === tileset_file ? result : undefined
  if (loaded?.problem) {
    return <p className="panel-hint">{loaded.problem}</p>
  }
  if (!loaded?.file || !loaded.url) {
    return null
  }
  const { file, url } = loaded
  const image_size = image?.url === url ? image : undefined
  const grid = image_size && grid_of(file, image_size.width, image_size.height)

  function cell_of(event: ReactPointerEvent<HTMLImageElement>): [number, number] | undefined {
    if (!grid || !image_size) {
      return undefined
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) * image_size.width) / rect.width - grid.margin
    const y = ((event.clientY - rect.top) * image_size.height) / rect.height - grid.margin
    const column = Math.floor(x / grid.stride_x)
    const row = Math.floor(y / grid.stride_y)
    if (column < 0 || row < 0 || column >= grid.columns || row >= grid.rows) {
      return undefined
    }
    return [column, row]
  }

  function on_pointer_down(event: ReactPointerEvent<HTMLImageElement>) {
    if (event.button !== 0 || !grid) {
      return
    }
    const cell = cell_of(event)
    if (!cell) {
      return
    }
    const [column, row] = cell
    const picked = row * grid.columns + column + 1
    const tile_count = grid.columns * grid.rows

    if (event.shiftKey && tile >= 1 && tile <= tile_count) {
      // Shift selects the rectangle between the last clicked tile and this one, which stays the anchor.
      const anchor_column = (tile - 1) % grid.columns
      const anchor_row = Math.floor((tile - 1) / grid.columns)
      const [left, right] = [Math.min(anchor_column, column), Math.max(anchor_column, column)]
      const [top, bottom] = [Math.min(anchor_row, row), Math.max(anchor_row, row)]
      const tiles: number[] = []
      for (let tile_row = top; tile_row <= bottom; ++tile_row) {
        for (let tile_column = left; tile_column <= right; ++tile_column) {
          tiles.push(tile_row * grid.columns + tile_column + 1)
        }
      }
      set_stamp(stamp_of(tiles, grid.columns))
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl toggles single tiles; a stamp from another tileset may hold numbers this one does not have.
      const selected = stamp.tiles.filter((selected_tile) => selected_tile > 0 && selected_tile <= tile_count)
      const removing = selected.includes(picked)
      const tiles = removing ? selected.filter((selected_tile) => selected_tile !== picked) : [...selected, picked]
      if (tiles.length === 0) {
        return
      }
      if (!removing) {
        set_tile(picked)
      }
      set_stamp(stamp_of(tiles, grid.columns))
    } else {
      set_tile(picked)
      set_stamp({ width: 1, height: 1, tiles: [picked] })
      dragging_ref.current = { origin: [column, row] }
      event.currentTarget.setPointerCapture(event.pointerId)
    }

    if (tool !== 'brush' && tool !== 'fill') {
      set_tool('brush')
    }
  }

  function on_pointer_move(event: ReactPointerEvent<HTMLImageElement>) {
    if (!dragging_ref.current || !grid || !image_size) {
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) * image_size.width) / rect.width - grid.margin
    const y = ((event.clientY - rect.top) * image_size.height) / rect.height - grid.margin
    const column = Math.max(0, Math.min(grid.columns - 1, Math.floor(x / grid.stride_x)))
    const row = Math.max(0, Math.min(grid.rows - 1, Math.floor(y / grid.stride_y)))
    const [origin_column, origin_row] = dragging_ref.current.origin
    const [left, right] = [Math.min(origin_column, column), Math.max(origin_column, column)]
    const [top, bottom] = [Math.min(origin_row, row), Math.max(origin_row, row)]
    const tiles: number[] = []
    for (let tile_row = top; tile_row <= bottom; ++tile_row) {
      for (let tile_column = left; tile_column <= right; ++tile_column) {
        tiles.push(tile_row * grid.columns + tile_column + 1)
      }
    }
    set_stamp(stamp_of(tiles, grid.columns))
  }

  function on_pointer_up(event: ReactPointerEvent<HTMLImageElement>) {
    if (dragging_ref.current) {
      dragging_ref.current = null
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    }
  }

  const tile_count = grid ? grid.columns * grid.rows : 0
  const selection = grid
    ? stamp.tiles
        .filter((selected_tile) => selected_tile > 0 && selected_tile <= tile_count)
        .map((selected_tile) => {
          const index = selected_tile - 1
          return {
            key: selected_tile,
            style: {
              left: `${(grid.margin + (index % grid.columns) * grid.stride_x) * palette_zoom}px`,
              top: `${(grid.margin + Math.floor(index / grid.columns) * grid.stride_y) * palette_zoom}px`,
              width: `${file.tile_size[0] * palette_zoom}px`,
              height: `${file.tile_size[1] * palette_zoom}px`,
            },
          }
        })
    : []

  return (
    <>
      <div className="tile-palette">
        <img
          src={url}
          alt="Tileset"
          draggable={false}
          onLoad={(event) =>
            set_image({ url, width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })
          }
          onPointerDown={on_pointer_down}
          onPointerMove={on_pointer_move}
          onPointerUp={on_pointer_up}
          onPointerCancel={on_pointer_up}
          style={{
            width: `${palette_zoom * (image?.width || 0)}px`,
            height: `${palette_zoom * (image?.height || 0)}px`,
          }}
        />
        {selection.map(({ key, style }) => (
          <div key={key} className="tile-palette-selection" style={style} />
        ))}
      </div>
      <div className="tile-palette-controls">
        <button
          type="button"
          className="toolbar-button"
          onClick={() => set_palette_zoom(Math.min(16, palette_zoom * 2))}
        >
          +
        </button>
        <button
          type="button"
          className="toolbar-button"
          onClick={() => set_palette_zoom(Math.max(0.25, palette_zoom / 2))}
        >
          -
        </button>
      </div>
    </>
  )
}
