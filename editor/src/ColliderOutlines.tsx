import { useEffect, useState, type RefObject } from 'react'
import { useCameraStore } from './camera_store'
import type { SceneEntity } from './project/scene_document'
import { useSceneStore } from './project/scene_store'

const degrees_per_radian = 180 / Math.PI

// Matches how the engine bakes the transform's scale into the Box2D shape, so the outline is the collision shape.
function Outline({ entity }: { entity: SceneEntity }) {
  const { collider, transform } = entity.components
  if (!collider) {
    return null
  }
  const position = transform?.position ?? [0, 0]
  const rotation = transform?.rotation ?? 0
  const [scale_x, scale_y] = transform?.scale ?? [1, 1]
  const center_x = collider.offset[0] * scale_x
  const center_y = collider.offset[1] * scale_y

  return (
    <g
      className={collider.sensor ? 'collider-outline collider-sensor' : 'collider-outline'}
      transform={`translate(${position[0]} ${position[1]}) rotate(${rotation * degrees_per_radian})`}
    >
      {collider.shape === 'box' ? (
        <rect
          x={center_x - (collider.size[0] * Math.abs(scale_x)) / 2}
          y={center_y - (collider.size[1] * Math.abs(scale_y)) / 2}
          width={collider.size[0] * Math.abs(scale_x)}
          height={collider.size[1] * Math.abs(scale_y)}
        />
      ) : (
        <circle cx={center_x} cy={center_y} r={collider.radius * Math.max(Math.abs(scale_x), Math.abs(scale_y))} />
      )}
    </g>
  )
}

// Draws every collider over the canvas. Hidden while playing, since the document keeps the pre-play positions.
export function ColliderOutlines({ canvas_ref }: { canvas_ref: RefObject<HTMLCanvasElement | null> }) {
  const position = useCameraStore((store) => store.position)
  const view_height = useCameraStore((store) => store.view_height)
  const entities = useSceneStore((store) => store.document?.entities)
  const [size, set_size] = useState<{ width: number; height: number }>()

  useEffect(() => {
    const canvas = canvas_ref.current
    if (!canvas) {
      return
    }
    const observer = new ResizeObserver(() => {
      const { width, height } = canvas.getBoundingClientRect()
      set_size({ width, height })
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [canvas_ref])

  if (!size || !entities) {
    return null
  }
  const pixels_per_unit = size.height / view_height

  // The group maps world units to pixels with y flipped, so outlines are written in world coordinates.
  return (
    <svg className="collider-outlines" aria-hidden="true">
      <g
        transform={`translate(${size.width / 2} ${size.height / 2}) scale(${pixels_per_unit} ${-pixels_per_unit}) translate(${-position.x} ${-position.y})`}
      >
        {entities.map((entity) => (
          <Outline key={entity.id} entity={entity} />
        ))}
      </g>
    </svg>
  )
}
