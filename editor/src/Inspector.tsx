import { useState, type ReactNode } from 'react'
import { useAssetFileDrop } from './asset_drag'
import { find_file_by_id } from './project/assets'
import { useAssetStore } from './project/asset_store'
import {
  component_defaults,
  type ComponentName,
  type Components,
  type SceneEntity,
  type Sprite,
  type Transform,
} from './project/scene_document'
import { useSceneStore } from './project/scene_store'

type NumberFieldProps = {
  label: string
  value: number
  step?: number
  on_change: (value: number) => void
}

// Keeps its own text so partial input such as "-" or "1." can be typed; only complete numbers reach the scene.
function NumberField({ label, value, step = 0.1, on_change }: NumberFieldProps) {
  const [text, set_text] = useState(String(value))
  const [shown_value, set_shown_value] = useState(value)
  // Picks up changes made elsewhere without overwriting text that is being typed.
  if (value !== shown_value) {
    set_shown_value(value)
    set_text(String(value))
  }

  return (
    <label className="number-field">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={text}
        onChange={(event) => {
          set_text(event.target.value)
          const parsed = event.target.valueAsNumber
          if (Number.isFinite(parsed)) {
            set_shown_value(parsed)
            on_change(parsed)
          }
        }}
      />
    </label>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="inspector-row">
      <span className="inspector-label">{label}</span>
      <div className="inspector-fields">{children}</div>
    </div>
  )
}

type VectorFieldsProps<T extends number[]> = {
  labels: string[]
  values: T
  on_change: (values: T) => void
}

function VectorFields<T extends number[]>({ labels, values, on_change }: VectorFieldsProps<T>) {
  return labels.map((label, index) => (
    <NumberField
      key={label}
      label={label}
      value={values[index]}
      on_change={(value) => {
        const copy = [...values] as T
        copy[index] = value
        on_change(copy)
      }}
    />
  ))
}

const degrees_per_radian = 180 / Math.PI

function TransformFields({ value, on_change }: { value: Transform; on_change: (value: Transform) => void }) {
  return (
    <>
      <Row label="Position">
        <VectorFields
          labels={['X', 'Y']}
          values={value.position}
          on_change={(position) => on_change({ ...value, position })}
        />
      </Row>
      <Row label="Rotation">
        <NumberField
          label="°"
          step={1}
          // Rounded so angles that radians cannot store exactly do not show as 44.99999.
          value={Number((value.rotation * degrees_per_radian).toFixed(4))}
          on_change={(degrees) => on_change({ ...value, rotation: degrees / degrees_per_radian })}
        />
      </Row>
      <Row label="Scale">
        <VectorFields labels={['X', 'Y']} values={value.scale} on_change={(scale) => on_change({ ...value, scale })} />
      </Row>
    </>
  )
}

function to_hex(channel: number): string {
  return Math.round(Math.min(1, Math.max(0, channel)) * 255)
    .toString(16)
    .padStart(2, '0')
}

function TextureField({ texture, on_change }: { texture: string; on_change: (texture: string) => void }) {
  const root = useAssetStore((store) => store.root)
  const drop = useAssetFileDrop(on_change)
  const file = root && texture ? find_file_by_id(root, texture) : undefined
  const label = !texture ? 'Drop an image here' : (file?.path ?? `Missing asset ${texture}`)

  return (
    <div className={`texture-field${drop.active ? ' drop-target' : ''}`} title={file?.path} {...drop.handlers}>
      <span className={file ? 'texture-name' : 'texture-name panel-hint'}>{label}</span>
      {texture && (
        <button type="button" className="toolbar-button" onClick={() => on_change('')}>
          Clear
        </button>
      )}
    </div>
  )
}

function SpriteFields({ value, on_change }: { value: Sprite; on_change: (value: Sprite) => void }) {
  const [r, g, b, a] = value.color
  return (
    <>
      <Row label="Texture">
        <TextureField texture={value.texture} on_change={(texture) => on_change({ ...value, texture })} />
      </Row>
      <Row label="Size">
        <VectorFields labels={['W', 'H']} values={value.size} on_change={(size) => on_change({ ...value, size })} />
      </Row>
      <Row label="Color">
        <input
          type="color"
          aria-label="Color"
          value={`#${to_hex(r)}${to_hex(g)}${to_hex(b)}`}
          onChange={(event) => {
            const hex = event.target.value
            const channel = (offset: number) => parseInt(hex.slice(offset, offset + 2), 16) / 255
            on_change({ ...value, color: [channel(1), channel(3), channel(5), a] })
          }}
        />
        <NumberField label="A" value={a} on_change={(alpha) => on_change({ ...value, color: [r, g, b, alpha] })} />
      </Row>
      <Row label="UV rect">
        <VectorFields
          labels={['U0', 'V0', 'U1', 'V1']}
          values={value.uv_rect}
          on_change={(uv_rect) => on_change({ ...value, uv_rect })}
        />
      </Row>
      <Row label="Order">
        <NumberField
          label="#"
          step={1}
          value={value.order}
          on_change={(order) => on_change({ ...value, order: Math.round(order) })}
        />
      </Row>
    </>
  )
}

const component_titles: Record<ComponentName, string> = { transform: 'Transform', sprite: 'Sprite' }

type ComponentSectionProps = {
  name: ComponentName
  on_remove: () => void
  children: ReactNode
}

function ComponentSection({ name, on_remove, children }: ComponentSectionProps) {
  return (
    <section className="inspector-component" aria-label={component_titles[name]}>
      <header className="panel-header">
        <h3 className="panel-title">{component_titles[name]}</h3>
        <button type="button" className="toolbar-button" onClick={on_remove}>
          Remove
        </button>
      </header>
      {children}
    </section>
  )
}

function EntityInspector({ entity }: { entity: SceneEntity }) {
  const update_entity = useSceneStore((store) => store.update_entity)
  const { transform, sprite } = entity.components
  const missing = (Object.keys(component_titles) as ComponentName[]).filter((name) => !entity.components[name])

  function set_component<Name extends ComponentName>(name: Name, value: Components[Name]) {
    update_entity(entity.id, (current) => {
      const components = { ...current.components, [name]: value }
      if (value === undefined) {
        delete components[name]
      }
      return { ...current, components }
    })
  }

  return (
    <>
      <label className="inspector-row">
        <span className="inspector-label">Name</span>
        <input
          className="inspector-name"
          value={entity.name}
          onChange={(event) => update_entity(entity.id, (current) => ({ ...current, name: event.target.value }))}
        />
      </label>
      {transform && (
        <ComponentSection name="transform" on_remove={() => set_component('transform', undefined)}>
          <TransformFields value={transform} on_change={(value) => set_component('transform', value)} />
        </ComponentSection>
      )}
      {sprite && (
        <ComponentSection name="sprite" on_remove={() => set_component('sprite', undefined)}>
          <SpriteFields value={sprite} on_change={(value) => set_component('sprite', value)} />
        </ComponentSection>
      )}
      {missing.length > 0 && (
        <div className="inspector-add">
          {missing.map((name) => (
            <button
              key={name}
              type="button"
              className="toolbar-button"
              onClick={() => set_component(name, component_defaults[name]())}
            >
              Add {component_titles[name]}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

export function Inspector() {
  const entity = useSceneStore((store) => store.document?.entities.find((candidate) => candidate.id === store.selected))

  return (
    <section className="panel inspector" aria-label="Inspector">
      {entity ? (
        <EntityInspector key={entity.id} entity={entity} />
      ) : (
        <p className="panel-hint">Select an entity to edit it.</p>
      )}
    </section>
  )
}
