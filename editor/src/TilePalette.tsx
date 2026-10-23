import { useEffect, useState, type MouseEvent } from 'react'
import { find_file_by_id, type AssetFile } from './project/assets'
import { useAssetStore } from './project/asset_store'
import { is_tileset_name } from './project/tilemap'
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

// Shows the tileset's image cut into its tiles; clicking a tile picks it for the brush.
export function TilePalette({ tileset }: { tileset: string }) {
  const root = useAssetStore((store) => store.root)
  const tile = useTilemapToolStore((store) => store.tile)
  const tool = useTilemapToolStore((store) => store.tool)
  const { set_tile, set_tool } = useTilemapToolStore.getState()
  const [result, set_result] = useState<LoadedTileset>()
  const [image, set_image] = useState<{ url: string; width: number; height: number }>()
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

  function pick(event: MouseEvent<HTMLImageElement>) {
    if (!grid || !image_size) {
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) * image_size.width) / rect.width - grid.margin
    const y = ((event.clientY - rect.top) * image_size.height) / rect.height - grid.margin
    const column = Math.floor(x / grid.stride_x)
    const row = Math.floor(y / grid.stride_y)
    if (column < 0 || row < 0 || column >= grid.columns || row >= grid.rows) {
      return
    }
    set_tile(row * grid.columns + column + 1)
    if (tool !== 'brush' && tool !== 'fill') {
      set_tool('brush')
    }
  }

  const index = tile - 1
  const selected =
    grid && image_size && index < grid.columns * grid.rows
      ? {
          left: `${((grid.margin + (index % grid.columns) * grid.stride_x) / image_size.width) * 100}%`,
          top: `${((grid.margin + Math.floor(index / grid.columns) * grid.stride_y) / image_size.height) * 100}%`,
          width: `${(file.tile_size[0] / image_size.width) * 100}%`,
          height: `${(file.tile_size[1] / image_size.height) * 100}%`,
        }
      : undefined

  return (
    <div className="tile-palette">
      <img
        src={url}
        alt="Tileset"
        draggable={false}
        onLoad={(event) =>
          set_image({ url, width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })
        }
        onClick={pick}
      />
      {selected && <div className="tile-palette-selection" style={selected} />}
    </div>
  )
}
