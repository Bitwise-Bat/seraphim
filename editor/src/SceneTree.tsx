import { useCallback, useState, type MouseEvent } from 'react'
import { ContextMenu, type ContextMenuItem } from './ContextMenu'
import { main_scene_file } from './project/scenes'
import { useSceneStore } from './project/scene_store'
import { RenameInput } from './RenameInput'

type MenuState = { x: number; y: number; items: ContextMenuItem[]; trigger: HTMLElement }

export function SceneTree() {
  const document = useSceneStore((store) => store.document)
  const selected = useSceneStore((store) => store.selected)
  const dirty = useSceneStore((store) => store.dirty)
  const error = useSceneStore((store) => store.error)
  const select = useSceneStore((store) => store.select)
  const add_entity = useSceneStore((store) => store.add_entity)
  const remove_entity = useSceneStore((store) => store.remove_entity)
  const update_entity = useSceneStore((store) => store.update_entity)
  const [renaming, set_renaming] = useState<string>()
  const [menu, set_menu] = useState<MenuState>()
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

  return (
    <section className="overflow-auto min-w-0 p-3 bg-panel" aria-label="Scene">
      <header className="flex gap-2 items-center justify-between mb-2">
        <h2 className="overflow-hidden m-0 text-[0.9rem] font-semibold text-ellipsis whitespace-nowrap">
          {main_scene_file}
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
      <ul className="m-0 p-0 list-none flex flex-col gap-0.5">
        {document?.entities.map((entity) => (
          <li key={entity.id}>
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
                className={`block w-full overflow-hidden px-2 py-0.5 border-0 rounded text-left text-ellipsis whitespace-nowrap transition-colors cursor-pointer text-[0.85rem] ${
                  entity.id === selected
                    ? 'bg-control-hover text-accent font-medium'
                    : 'bg-transparent text-text hover:bg-control'
                }`}
                aria-current={entity.id === selected ? 'true' : undefined}
                onClick={() => select(entity.id)}
                onDoubleClick={() => set_renaming(entity.id)}
                onContextMenu={(event) => open_menu(event, entity.id)}
              >
                {entity.name || 'Unnamed'}
              </button>
            )}
          </li>
        ))}
      </ul>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} on_close={close_menu} />}
    </section>
  )
}
