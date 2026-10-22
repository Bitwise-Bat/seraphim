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
    <section className="panel scene-tree" aria-label="Scene">
      <header className="panel-header">
        <h2 className="panel-title">
          {main_scene_file}
          {dirty && <span title="Unsaved changes (Ctrl+S saves)"> •</span>}
        </h2>
        {document && (
          <button type="button" className="toolbar-button" onClick={() => set_renaming(add_entity())}>
            Add entity
          </button>
        )}
      </header>
      {error && <p role="alert">{error}</p>}
      {document?.entities.length === 0 && <p className="panel-hint">The scene is empty.</p>}
      <ul className="scene-entities">
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
                className="scene-entity"
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
