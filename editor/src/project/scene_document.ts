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

export type Components = {
  transform?: Transform
  sprite?: Sprite
}

export type ComponentName = keyof Components

export type SceneEntity = {
  id: string
  name: string
  components: Components
}

export type SceneDocument = {
  format_version: number
  entities: SceneEntity[]
}

export const component_defaults: { [Name in ComponentName]-?: () => NonNullable<Components[Name]> } = {
  transform: () => ({ position: [0, 0], rotation: 0, scale: [1, 1] }),
  sprite: () => ({ texture: '', size: [1, 1], uv_rect: [0, 0, 1, 1], color: [1, 1, 1, 1], order: 0 }),
}
