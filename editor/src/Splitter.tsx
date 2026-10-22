import type { Dispatch, KeyboardEvent, PointerEvent, SetStateAction } from 'react'

type SplitterProps = {
  label: string
  // A horizontal bar separates panels stacked on top of each other; a vertical bar separates side-by-side panels.
  orientation: 'horizontal' | 'vertical'
  // Which neighbor's size, in pixels, the splitter controls: the panel before it (above or left) or after it.
  panel: 'before' | 'after'
  size: number
  min: number
  max: number
  on_resize: Dispatch<SetStateAction<number>>
}

const keyboard_step = 16

const key_offsets: Record<string, number> = {
  ArrowUp: -keyboard_step,
  ArrowLeft: -keyboard_step,
  ArrowDown: keyboard_step,
  ArrowRight: keyboard_step,
}

// Resizes a neighboring panel by dragging, or with the arrow keys when focused.
export function Splitter({ label, orientation, panel, size, min, max, on_resize }: SplitterProps) {
  // Moving the bar towards the controlled panel shrinks it.
  const direction = panel === 'before' ? 1 : -1
  // Updates are relative to the latest size, since several pointer events can arrive before React re-renders.
  const move_by = (offset: number) =>
    on_resize((current) => Math.min(max, Math.max(min, current + offset * direction)))

  function on_pointer_down(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function on_pointer_move(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      move_by(orientation === 'horizontal' ? event.movementY : event.movementX)
    }
  }

  function on_key_down(event: KeyboardEvent<HTMLDivElement>) {
    const offset = key_offsets[event.key]
    if (offset !== undefined) {
      event.preventDefault()
      move_by(offset)
    }
  }

  return (
    <div
      className={`splitter splitter-${orientation}`}
      role="separator"
      aria-label={label}
      aria-orientation={orientation}
      aria-valuenow={size}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={on_pointer_down}
      onPointerMove={on_pointer_move}
      onKeyDown={on_key_down}
    />
  )
}
