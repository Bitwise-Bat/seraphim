export type Vec2 = [number, number]
export type Vec4 = [number, number, number, number]

// Mirrors the components in engine/scene/components.hpp, as written by the engine's scene serializer.
export type Transform = {
  position: Vec2
  // Counter-clockwise, in radians.
  rotation: number
  scale: Vec2
}

export type Sprite = {
  // Asset id of the texture, or empty for none.
  texture: string
  size: Vec2
  uv_rect: Vec4
  color: Vec4
  order: number
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
}

// Asset ids of the scripts that drive the entity, run in list order.
export type Scripts = {
  assets: string[]
}

export type Components = {
  transform?: Transform
  sprite?: Sprite
  rigidbody?: Rigidbody
  collider?: Collider
  animator?: Animator
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
  sprite: () => ({ texture: '', size: [1, 1], uv_rect: [0, 0, 1, 1], color: [1, 1, 1, 1], order: 0 }),
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
  }),
  animator: () => ({ animation_set: '', clip: '' }),
  scripts: () => ({ assets: [] }),
}
