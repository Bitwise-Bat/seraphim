import type { Dispatch, KeyboardEvent, PointerEvent, SetStateAction } from 'react'

type SplitterProps = {
  label: string
  // Size of the panel below the splitter, in pixels.
  size: number
  min: number
  max: number
  on_resize: Dispatch<SetStateAction<number>>
}

const keyboard_step = 16

// A horizontal bar that resizes the panel below it by dragging, or with the arrow keys when focused.
export function Splitter({ label, size, min, max, on_resize }: SplitterProps) {
  // Updates are relative to the latest size, since several pointer events can arrive before React re-renders.
  const resize_by = (delta: number) => on_resize((current) => Math.min(max, Math.max(min, current + delta)))

  function on_pointer_down(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function on_pointer_move(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      resize_by(-event.movementY)
    }
  }

  function on_key_down(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowUp') {
      resize_by(keyboard_step)
    } else if (event.key === 'ArrowDown') {
      resize_by(-keyboard_step)
    }
  }

  return (
    <div
      className="splitter"
      role="separator"
      aria-label={label}
      aria-orientation="horizontal"
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
