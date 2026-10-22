import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'

export type ContextMenuItem = {
  label: string
  action: () => void
}

type ContextMenuProps = {
  x: number
  y: number
  items: ContextMenuItem[]
  on_close: () => void
}

const edge_margin = 4

export function ContextMenu({ x, y, items, on_close }: ContextMenuProps) {
  const menu = useRef<HTMLUListElement>(null)
  const [position, set_position] = useState({ x, y })

  // Keeps the menu inside the window when opened near the right or bottom edge.
  useLayoutEffect(() => {
    if (!menu.current) {
      return
    }
    const { width, height } = menu.current.getBoundingClientRect()
    set_position({
      x: Math.max(edge_margin, Math.min(x, window.innerWidth - width - edge_margin)),
      y: Math.max(edge_margin, Math.min(y, window.innerHeight - height - edge_margin)),
    })
  }, [x, y])

  useEffect(() => {
    menu.current?.querySelector('button')?.focus()

    function close_on_outside(event: PointerEvent) {
      if (!menu.current?.contains(event.target as Node)) {
        on_close()
      }
    }
    window.addEventListener('pointerdown', close_on_outside)
    window.addEventListener('blur', on_close)
    window.addEventListener('resize', on_close)
    return () => {
      window.removeEventListener('pointerdown', close_on_outside)
      window.removeEventListener('blur', on_close)
      window.removeEventListener('resize', on_close)
    }
  }, [on_close])

  function on_key_down(event: KeyboardEvent<HTMLUListElement>) {
    const buttons = [...(menu.current?.querySelectorAll('button') ?? [])]
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'Escape') {
      on_close()
    } else if (event.key === 'ArrowDown') {
      buttons[(index + 1) % buttons.length]?.focus()
    } else if (event.key === 'ArrowUp') {
      buttons[(index - 1 + buttons.length) % buttons.length]?.focus()
    } else {
      return
    }
    event.preventDefault()
  }

  return (
    <ul
      ref={menu}
      className="context-menu"
      role="menu"
      style={{ left: position.x, top: position.y }}
      onKeyDown={on_key_down}
    >
      {items.map((item) => (
        <li key={item.label} role="none">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              on_close()
              item.action()
            }}
          >
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  )
}
