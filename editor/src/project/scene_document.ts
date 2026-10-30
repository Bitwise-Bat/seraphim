import { empty_layer } from './tilemap'

export type Vec2 = [number, number]
export type Vec4 = [number, number, number, number]

// Mirrors the components in engine/scene/components.hpp, as written by the engine's scene serializer.
export type Transform = {
  position: Vec2
  // Counter-clockwise, in radians.
  rotation: number
  scale: Vec2
}

export type SpriteLayer = {
  name: string, 
  texture: string,
  offset: Vec2,
  color: Vec4,
  order: number
}

export type Sprite = {
  // Asset id of the texture, or empty for none.
  texture: string
  size: Vec2
  uv_rect: Vec4
  color: Vec4
  order: number
  layers?: SpriteLayer[]
}

export type BodyType = 'static' | 'kinematic' | 'dynamic'

export type Rigidbody = {
  type: BodyType
  gravity_scale: number
  fixed_rotation: boolean
}

export type Animator = {
  // Asset id of the animation set, or empty for none.
  animation_set: string
  // Name of the clip that plays when the scene starts.
  clip: string
}

export type ColliderShape = 'box' | 'circle'

// Without a rigidbody the collider is static. Sizes are in world units before the transform's scale.
export type Collider = {
  shape: ColliderShape
  size: Vec2
  // Used by circles only.
  radius: number
  offset: Vec2
  density: number
  friction: number
  restitution: number
  sensor: boolean
  category_bits?: number
  mask_bits?: number
}

// Plays a sound while the scene is simulated.
export type AudioSource = {
  // Asset id of the sound, or empty for none.
  sound: string
  // 1 plays the sound as recorded.
  volume: number
  loop: boolean
  play_on_start: boolean
  // Pans and fades the sound by the entity's position relative to the camera.
  spatial: boolean
}

export type TilemapLayer = {
  // One string per row from the top, holding the row's tile numbers separated by spaces; 0 is an empty cell.
  rows: string[]
}

export type TilemapOrientation = 'orthogonal' | 'isometric'

// The transform's position is the top-left corner of the map, or the top corner of an isometric one.
export type Tilemap = {
  // Asset id of the tileset, or empty for none.
  tileset: string
  orientation: TilemapOrientation
  // In world units, before the transform's scale. For isometric maps this is the diamond's full width and height.
  cell_size: Vec2
  // In cells.
  size: Vec2
  // Later layers are drawn on top.
  layers: TilemapLayer[]
  order: number
}

// Marks an entity whose state the server sends to every client.
export type Networked = Record<string, never>

// Asset ids of the scripts that drive the entity, run in list order.
export type Scripts = {
  assets: string[]
  properties?: Record<string, Record<string, unknown>>
}

export type Components = {
  transform?: Transform
  sprite?: Sprite
  rigidbody?: Rigidbody
  collider?: Collider
  animator?: Animator
  audio_source?: AudioSource
  tilemap?: Tilemap
  networked?: Networked
  scripts?: Scripts
}

export type ComponentName = keyof Components

export type SceneEntity = {
  id: string
  name: string
  components: Components
}

export type SceneDocument = {
  format_version: number
  // In meters per second squared.
  gravity: Vec2
  entities: SceneEntity[]
}

export const component_defaults: { [Name in ComponentName]-?: () => NonNullable<Components[Name]> } = {
  transform: () => ({ position: [0, 0], rotation: 0, scale: [1, 1] }),
  sprite: () => ({ texture: '', size: [1, 1], uv_rect: [0, 0, 1, 1], color: [1, 1, 1, 1], order: 0, layers: [] }),
  rigidbody: () => ({ type: 'dynamic', gravity_scale: 1, fixed_rotation: false }),
  collider: () => ({
    shape: 'box',
    size: [1, 1],
    radius: 0.5,
    offset: [0, 0],
    density: 1,
    friction: 0.6,
    restitution: 0,
    sensor: false,
    category_bits: 1,
    mask_bits: 0xffff,
  }),
  animator: () => ({ animation_set: '', clip: '' }),
  audio_source: () => ({ sound: '', volume: 1, loop: false, play_on_start: false, spatial: false }),
  tilemap: () => ({
    tileset: '',
    orientation: 'orthogonal',
    cell_size: [1, 1],
    size: [16, 16],
    layers: [empty_layer([16, 16])],
    order: 0,
  }),
  networked: () => ({}),
  scripts: () => ({ assets: [] }),
}
