import type { Tilemap, TilemapLayer, Transform, Vec2 } from './scene_document'

// Column and row, counted from the top-left cell.
export type Cell = [number, number]

// A rectangle of tile numbers, row by row, that the brush and fill paint with; 0 cells leave the map as it is.
export type Stamp = { width: number; height: number; tiles: number[] }

export function is_tileset_name(name: string): boolean {
  return name.endsWith('.tileset.json')
}

// Tiles are edited as rows of numbers and written back as the row strings the engine reads.
type TileGrid = number[][]

function read_grid(layer: TilemapLayer): TileGrid {
  return layer.rows.map((row) => (row ? row.split(' ').map(Number) : []))
}

function write_grid(grid: TileGrid): TilemapLayer {
  return { rows: grid.map((row) => row.join(' ')) }
}

export function empty_layer([width, height]: Vec2): TilemapLayer {
  return write_grid(Array.from({ length: height }, () => Array<number>(width).fill(0)))
}

// Keeps the tiles that still fit, so growing or shrinking the map does not move what is already painted.
export function resize_tilemap(map: Tilemap, size: Vec2): Tilemap {
  const [width, height] = size
  const layers = map.layers.map((layer) => {
    const grid = read_grid(layer)
    return write_grid(
      Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => grid[y]?.[x] ?? 0)),
    )
  })
  return { ...map, size, layers }
}

// Undoes the transform the engine draws the map with; undefined outside the map.
export function cell_at(map: Tilemap, transform: Transform, world: Vec2): Cell | undefined {
  const offset_x = world[0] - transform.position[0]
  const offset_y = world[1] - transform.position[1]
  const cosine = Math.cos(transform.rotation)
  const sine = Math.sin(transform.rotation)
  const local_x = offset_x * cosine + offset_y * sine
  const local_y = offset_y * cosine - offset_x * sine
  const x = Math.floor(local_x / (map.cell_size[0] * transform.scale[0]))
  const y = Math.floor(-local_y / (map.cell_size[1] * transform.scale[1]))
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= map.size[0] || y >= map.size[1]) {
    return undefined
  }
  return [x, y]
}

// Every cell on the straight line between two cells, so a fast stroke leaves no gaps.
export function cells_between(from: Cell, to: Cell): Cell[] {
  const steps = Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1]))
  return Array.from({ length: steps + 1 }, (_, step): Cell => {
    const t = steps === 0 ? 0 : step / steps
    return [Math.round(from[0] + (to[0] - from[0]) * t), Math.round(from[1] + (to[1] - from[1]) * t)]
  })
}

function with_layer(map: Tilemap, layer: number, change: (grid: TileGrid) => void): Tilemap {
  const current = map.layers[layer]
  if (!current) {
    return map
  }
  const grid = read_grid(current)
  change(grid)
  return { ...map, layers: map.layers.with(layer, write_grid(grid)) }
}

export function paint_cells(map: Tilemap, layer: number, cells: Cell[], tile: number): Tilemap {
  return with_layer(map, layer, (grid) => {
    for (const [x, y] of cells) {
      if (grid[y]?.[x] !== undefined) {
        grid[y][x] = tile
      }
    }
  })
}

// Puts the stamp's top-left tile on each origin; the parts that fall outside the map are dropped.
export function paint_stamp(map: Tilemap, layer: number, origins: Cell[], stamp: Stamp): Tilemap {
  return with_layer(map, layer, (grid) => {
    for (const [origin_x, origin_y] of origins) {
      for (let y = 0; y < stamp.height; ++y) {
        for (let x = 0; x < stamp.width; ++x) {
          const tile = stamp.tiles[y * stamp.width + x]
          if (tile && grid[origin_y + y]?.[origin_x + x] !== undefined) {
            grid[origin_y + y][origin_x + x] = tile
          }
        }
      }
    }
  })
}

function wrap(value: number, size: number): number {
  return ((value % size) + size) % size
}

// Repeats the stamp from the start cell over the connected area of cells that hold the same tile as the start cell,
// not crossing diagonals.
export function flood_fill(map: Tilemap, layer: number, start: Cell, stamp: Stamp): Tilemap {
  return with_layer(map, layer, (grid) => {
    const target = grid[start[1]]?.[start[0]]
    if (target === undefined) {
      return
    }
    // The area is found before painting, since a stamp may put the target tile back into it.
    const area: Cell[] = []
    const seen = new Set<number>()
    const pending: Cell[] = [start]
    for (let cell = pending.pop(); cell; cell = pending.pop()) {
      const [x, y] = cell
      const key = y * map.size[0] + x
      if (grid[y]?.[x] !== target || seen.has(key)) {
        continue
      }
      seen.add(key)
      area.push(cell)
      pending.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
    }
    for (const [x, y] of area) {
      const tile = stamp.tiles[wrap(y - start[1], stamp.height) * stamp.width + wrap(x - start[0], stamp.width)]
      if (tile) {
        grid[y][x] = tile
      }
    }
  })
}
