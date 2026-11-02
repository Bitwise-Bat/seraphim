import { useCallback, useRef, useState, type DragEvent, type MouseEvent } from 'react'
import { ContextMenu, type ContextMenuItem } from './ContextMenu'
import { main_scene_file } from './project/scenes'
import { useSceneStore } from './project/scene_store'
import { RenameInput } from './RenameInput'

type MenuState = { x: number; y: number; items: ContextMenuItem[]; trigger: HTMLElement }
type DropTarget = { id: string; place: 'before' | 'after' }

export function SceneTree() {
  const document = useSceneStore((store) => store.document)
  const current_scene_name = useSceneStore((store) => store.current_scene_name)
  const selected = useSceneStore((store) => store.selected)
  const dirty = useSceneStore((store) => store.dirty)
  const error = useSceneStore((store) => store.error)
  const playing = useSceneStore((store) => store.playing)
  const select = useSceneStore((store) => store.select)
  const add_entity = useSceneStore((store) => store.add_entity)
  const remove_entity = useSceneStore((store) => store.remove_entity)
  const update_entity = useSceneStore((store) => store.update_entity)
  const reorder_entity = useSceneStore((store) => store.reorder_entity)
  const [renaming, set_renaming] = useState<string>()
  const [menu, set_menu] = useState<MenuState>()
  const [dragging_id, set_dragging_id] = useState<string>()
  const [drop_target, set_drop_target] = useState<DropTarget>()
  const dragged_ref = useRef<string | undefined>(undefined)

  const close_menu = useCallback(() => {
    menu?.trigger.focus()
    set_menu(undefined)
  }, [menu])

  function open_menu(event: MouseEvent, id: string) {
    event.preventDefault()
    select(id)
    set_menu({
      x: event.clientX,
      y: event.clientY,
      trigger: event.currentTarget as HTMLElement,
      items: [
        { label: 'Rename', action: () => set_renaming(id) },
        { label: 'Delete', action: () => remove_entity(id) },
      ],
    })
  }

  function handle_drag_start(event: DragEvent<HTMLLIElement>, id: string) {
    if (playing || renaming === id) {
      event.preventDefault()
      return
    }
    dragged_ref.current = id
    set_dragging_id(id)
    event.dataTransfer.setData('application/x-seraphim-entity', id)
    event.dataTransfer.effectAllowed = 'move'
  }

  function handle_drag_end() {
    dragged_ref.current = undefined
    set_dragging_id(undefined)
    set_drop_target(undefined)
  }

  function handle_drag_over(event: DragEvent<HTMLLIElement>, target_id: string) {
    const source_id = dragged_ref.current
    if (!source_id || source_id === target_id) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'

    const rect = event.currentTarget.getBoundingClientRect()
    const place = event.clientY > rect.top + rect.height / 2 ? 'after' : 'before'
    if (drop_target?.id !== target_id || drop_target?.place !== place) {
      set_drop_target({ id: target_id, place })
    }
  }

  function handle_drag_leave(event: DragEvent<HTMLLIElement>, target_id: string) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      if (drop_target?.id === target_id) {
        set_drop_target(undefined)
      }
    }
  }

  function handle_drop(event: DragEvent<HTMLLIElement>, target_id: string) {
    const source_id = dragged_ref.current || event.dataTransfer.getData('application/x-seraphim-entity')
    if (!source_id || source_id === target_id) return
    event.preventDefault()
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    const place = event.clientY > rect.top + rect.height / 2 ? 'after' : 'before'
    reorder_entity(source_id, target_id, place)
    handle_drag_end()
  }

  function handle_container_drag_over(event: DragEvent<HTMLUListElement>) {
    if (!dragged_ref.current) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  function handle_container_drop(event: DragEvent<HTMLUListElement>) {
    const source_id = dragged_ref.current || event.dataTransfer.getData('application/x-seraphim-entity')
    if (!source_id) return
    event.preventDefault()
    reorder_entity(source_id)
    handle_drag_end()
  }

  return (
    <section className="overflow-auto min-w-0 p-3 bg-panel" aria-label="Scene">
      <header className="flex gap-2 items-center justify-between mb-2">
        <h2 className="overflow-hidden m-0 text-[0.9rem] font-semibold text-ellipsis whitespace-nowrap">
          {current_scene_name || main_scene_file}
          {dirty && <span title="Unsaved changes (Ctrl+S saves)"> •</span>}
        </h2>
        {document && (
          <button
            type="button"
            className="px-2 py-0.5 border border-border rounded bg-control text-[0.85rem] shrink-0 hover:bg-control-hover transition-colors cursor-pointer text-inherit"
            onClick={() => set_renaming(add_entity())}
          >
            Add entity
          </button>
        )}
      </header>
      {error && <p role="alert" className="text-red-400 text-sm mb-2">{error}</p>}
      {document?.entities.length === 0 && <p className="text-text-muted text-sm">The scene is empty.</p>}
      <ul
        className="m-0 p-0 list-none flex flex-col gap-0.5 min-h-16"
        onDragOver={handle_container_drag_over}
        onDrop={handle_container_drop}
      >
        {document?.entities.map((entity) => {
          const is_target = drop_target?.id === entity.id
          const is_dragging = dragging_id === entity.id

          return (
            <li
              key={entity.id}
              draggable={!playing && renaming !== entity.id}
              onDragStart={(event) => handle_drag_start(event, entity.id)}
              onDragEnd={handle_drag_end}
              onDragOver={(event) => handle_drag_over(event, entity.id)}
              onDragLeave={(event) => handle_drag_leave(event, entity.id)}
              onDrop={(event) => handle_drop(event, entity.id)}
              className={`relative transition-opacity ${is_dragging ? 'opacity-40' : ''}`}
            >
              {is_target && drop_target.place === 'before' && (
                <div className="absolute -top-0.5 left-0 right-0 h-0.5 bg-accent z-10 pointer-events-none rounded shadow-[0_0_4px_var(--color-accent)]" />
              )}
              {is_target && drop_target.place === 'after' && (
                <div className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-accent z-10 pointer-events-none rounded shadow-[0_0_4px_var(--color-accent)]" />
              )}
              {renaming === entity.id ? (
                <RenameInput
                  name={entity.name}
                  on_commit={(name) => {
                    set_renaming(undefined)
                    if (name) {
                      update_entity(entity.id, (current) => ({ ...current, name }))
                    }
                  }}
                  on_cancel={() => set_renaming(undefined)}
                />
              ) : (
                <button
                  type="button"
                  className={`flex items-center gap-1.5 w-full overflow-hidden px-2 py-0.5 border-0 rounded text-left text-ellipsis whitespace-nowrap transition-colors cursor-grab active:cursor-grabbing text-[0.85rem] ${
                    entity.id === selected
                      ? 'bg-control-hover text-accent font-medium'
                      : 'bg-transparent text-text hover:bg-control'
                  }`}
                  aria-current={entity.id === selected ? 'true' : undefined}
                  onClick={() => select(entity.id)}
                  onDoubleClick={() => set_renaming(entity.id)}
                  onContextMenu={(event) => open_menu(event, entity.id)}
                >
                  <span className="inline-flex shrink-0 opacity-40 hover:opacity-100 text-xs text-text-muted select-none">
                    ⋮⋮
                  </span>
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap flex-1">
                    {entity.name || 'Unnamed'}
                  </span>
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} on_close={close_menu} />}
    </section>
  )
}
