import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'
import { useCameraStore } from './camera_store'
import type { Transform, Vec2 } from './project/scene_document'
import { useSceneStore } from './project/scene_store'
import { useSettingsStore } from './settings_store'

type Mode = 'move' | 'rotate' | 'scale'
type Handle = 'x' | 'y' | 'free' | 'rotate' | 'scale_x' | 'scale_y' | 'scale_uniform'

type Drag = {
  handle: Handle
  pointer_start: Vec2
  start: Transform
}

const modes: { mode: Mode; label: string; key: string }[] = [
  { mode: 'move', label: 'Move', key: 'w' },
  { mode: 'rotate', label: 'Rotate', key: 'e' },
  { mode: 'scale', label: 'Scale', key: 'r' },
]

// In CSS pixels, so handles keep their size at every zoom level.
const axis_length = 70
const ring_radius = 55
const handle_size = 12
const degrees_per_radian = 180 / Math.PI

function pointer_world(canvas: HTMLCanvasElement, event: PointerEvent): Vec2 {
  const { position, view_height } = useCameraStore.getState()
  const rect = canvas.getBoundingClientRect()
  const units_per_pixel = view_height / rect.height
  return [
    position.x + (event.clientX - rect.left - rect.width / 2) * units_per_pixel,
    position.y + (rect.height / 2 - (event.clientY - rect.top)) * units_per_pixel,
  ]
}

// Ratio of how far the pointer is along an axis now versus when the drag started, measured from the entity.
function axis_ratio(from: Vec2, to: Vec2, axis: Vec2): number | undefined {
  const start = from[0] * axis[0] + from[1] * axis[1]
  return Math.abs(start) < 1e-6 ? undefined : (to[0] * axis[0] + to[1] * axis[1]) / start
}

function dragged_transform(
  { handle, pointer_start, start }: Drag,
  pointer: Vec2,
  snap_to_grid = false,
  grid_size = 1,
): Transform {
  const snap = (v: number) => (snap_to_grid && grid_size > 0 ? Math.round(v / grid_size) * grid_size : v)
  const [x, y] = start.position
  const delta: Vec2 = [pointer[0] - pointer_start[0], pointer[1] - pointer_start[1]]
  const from: Vec2 = [pointer_start[0] - x, pointer_start[1] - y]
  const to: Vec2 = [pointer[0] - x, pointer[1] - y]

  switch (handle) {
    case 'x':
      return { ...start, position: [snap(x + delta[0]), y] }
    case 'y':
      return { ...start, position: [x, snap(y + delta[1])] }
    case 'free':
      return { ...start, position: [snap(x + delta[0]), snap(y + delta[1])] }
    case 'rotate':
      return { ...start, rotation: start.rotation + Math.atan2(to[1], to[0]) - Math.atan2(from[1], from[0]) }
    case 'scale_uniform': {
      const ratio = Math.hypot(...from) < 1e-6 ? 1 : Math.hypot(...to) / Math.hypot(...from)
      return { ...start, scale: [start.scale[0] * ratio, start.scale[1] * ratio] }
    }
    case 'scale_x':
    case 'scale_y': {
      // Scale applies in the entity's own space, so the pointer is measured along its rotated axes.
      const cos = Math.cos(start.rotation)
      const sin = Math.sin(start.rotation)
      const along_x = handle === 'scale_x'
      const ratio = axis_ratio(from, to, along_x ? [cos, sin] : [-sin, cos]) ?? 1
      return {
        ...start,
        scale: along_x ? [start.scale[0] * ratio, start.scale[1]] : [start.scale[0], start.scale[1] * ratio],
      }
    }
  }
}

function is_typing(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
}

// Handles for moving, rotating and scaling the selected entity, drawn over the canvas. W, E and R switch modes.
export function Gizmo({ canvas_ref }: { canvas_ref: RefObject<HTMLCanvasElement | null> }) {
  const position = useCameraStore((store) => store.position)
  const view_height = useCameraStore((store) => store.view_height)
  const entity = useSceneStore((store) => store.document?.entities.find((candidate) => candidate.id === store.selected))
  const update_entity = useSceneStore((store) => store.update_entity)
  const [mode, set_mode] = useState<Mode>('move')
  const [size, set_size] = useState<{ width: number; height: number }>()
  const snap_to_grid = useSettingsStore((store) => store.snap_to_grid)
  const grid_size = useSettingsStore((store) => store.grid_size)
  const toggle_setting = useSettingsStore((store) => store.toggle_setting)
  const drag = useRef<Drag>(undefined)

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

  useEffect(() => {
    function on_key_down(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || is_typing(event.target)) {
        return
      }
      const match = modes.find(({ key }) => key === event.key.toLowerCase())
      if (match) {
        set_mode(match.mode)
      }
    }
    window.addEventListener('keydown', on_key_down)
    return () => window.removeEventListener('keydown', on_key_down)
  }, [])

  const transform = entity?.components.transform

  function handle_props(handle: Handle) {
    return {
      className: `gizmo-handle gizmo-${handle}`,
      onPointerDown(event: PointerEvent<SVGGElement>) {
        const canvas = canvas_ref.current
        if (!canvas || !transform || event.button !== 0) {
          return
        }
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = { handle, pointer_start: pointer_world(canvas, event), start: transform }
      },
      onPointerMove(event: PointerEvent<SVGGElement>) {
        const canvas = canvas_ref.current
        if (!canvas || !entity || !drag.current) {
          return
        }
        const next = dragged_transform(drag.current, pointer_world(canvas, event), snap_to_grid, grid_size)
        update_entity(entity.id, (current) =>
          current.components.transform ? { ...current, components: { ...current.components, transform: next } } : current,
        )
      },
      onPointerUp() {
        drag.current = undefined
      },
      onPointerCancel() {
        drag.current = undefined
      },
    }
  }

  let handles = null
  if (transform && size) {
    const units_per_pixel = view_height / size.height
    const center_x = size.width / 2 + (transform.position[0] - position.x) / units_per_pixel
    const center_y = size.height / 2 - (transform.position[1] - position.y) / units_per_pixel
    const half = handle_size / 2
    const square = <rect x={-half} y={-half} width={handle_size} height={handle_size} />

    // SVG y points down, so world axes and counter-clockwise angles are flipped.
    handles = (
      <g transform={`translate(${center_x} ${center_y})`}>
        {mode === 'move' && (
          <>
            <g {...handle_props('x')}>
              <line x2={axis_length} />
              <line className="gizmo-hit" x2={axis_length} />
              <polygon points={`${axis_length + 12},0 ${axis_length},-6 ${axis_length},6`} />
            </g>
            <g {...handle_props('y')}>
              <line y2={-axis_length} />
              <line className="gizmo-hit" y2={-axis_length} />
              <polygon points={`0,${-axis_length - 12} -6,${-axis_length} 6,${-axis_length}`} />
            </g>
            <g {...handle_props('free')}>{square}</g>
          </>
        )}
        {mode === 'rotate' && (
          <g {...handle_props('rotate')}>
            <circle r={ring_radius} />
            <circle className="gizmo-hit" r={ring_radius} />
          </g>
        )}
        {mode === 'scale' && (
          <g transform={`rotate(${-transform.rotation * degrees_per_radian})`}>
            <g {...handle_props('scale_x')}>
              <line x2={axis_length} />
              <line className="gizmo-hit" x2={axis_length} />
              <g transform={`translate(${axis_length} 0)`}>{square}</g>
            </g>
            <g {...handle_props('scale_y')}>
              <line y2={-axis_length} />
              <line className="gizmo-hit" y2={-axis_length} />
              <g transform={`translate(0 ${-axis_length})`}>{square}</g>
            </g>
            <g {...handle_props('scale_uniform')}>{square}</g>
          </g>
        )}
      </g>
    )
  }

  return (
    <>
      {handles && <svg className="gizmo">{handles}</svg>}
      <div className="gizmo-toolbar" role="toolbar" aria-label="Transform tool">
        {modes.map(({ mode: option, label, key }) => (
          <button
            key={option}
            type="button"
            className="toolbar-button"
            aria-pressed={mode === option}
            title={`${label} (${key.toUpperCase()})`}
            onClick={() => set_mode(option)}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className="toolbar-button"
          aria-pressed={snap_to_grid}
          title={`Snap to Grid (${grid_size}u)`}
          onClick={() => toggle_setting('snap_to_grid')}
        >
          Snap
        </button>
      </div>
    </>
  )
}
