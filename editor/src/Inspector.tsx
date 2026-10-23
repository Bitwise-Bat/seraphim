import { useState, type ReactNode } from 'react'
import { useStore } from 'zustand'
import { useAssetFileDrop } from './asset_drag'
import { find_file_by_id } from './project/assets'
import { useAssetStore, useScriptStore, type AssetStoreHook } from './project/asset_store'
import {
  component_defaults,
  type Animator,
  type BodyType,
  type Collider,
  type ColliderShape,
  type ComponentName,
  type Components,
  type Rigidbody,
  type SceneDocument,
  type SceneEntity,
  type Scripts,
  type Sprite,
  type Tilemap,
  type Transform,
} from './project/scene_document'
import { useSceneStore } from './project/scene_store'
import { empty_layer, is_tileset_name, resize_tilemap } from './project/tilemap'
import { TilePalette } from './TilePalette'
import { useTilemapToolStore, type TilemapTool } from './tilemap_tool_store'

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

type SelectFieldProps<T extends string> = {
  label: string
  value: T
  options: { value: T; label: string }[]
  on_change: (value: T) => void
}

function SelectField<T extends string>({ label, value, options, on_change }: SelectFieldProps<T>) {
  return (
    <select aria-label={label} value={value} onChange={(event) => on_change(event.target.value as T)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

function CheckboxField({
  label,
  value,
  on_change,
}: {
  label: string
  value: boolean
  on_change: (value: boolean) => void
}) {
  return (
    <input type="checkbox" aria-label={label} checked={value} onChange={(event) => on_change(event.target.checked)} />
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

type AssetFieldProps = {
  store: AssetStoreHook
  // Empty when no asset is set.
  asset: string
  placeholder: string
  clear_label?: string
  accepts?: (name: string) => boolean
  on_change: (asset: string) => void
}

function AssetField({ store, asset, placeholder, clear_label = 'Clear', accepts, on_change }: AssetFieldProps) {
  const root = useStore(store, (state) => state.root)
  const drop = useAssetFileDrop(store, on_change, accepts)
  const file = root && asset ? find_file_by_id(root, asset) : undefined
  const label = !asset ? placeholder : (file?.path ?? `Missing asset ${asset}`)

  return (
    <div className={`asset-field${drop.active ? ' drop-target' : ''}`} title={file?.path} {...drop.handlers}>
      <span className={file ? 'asset-field-name' : 'asset-field-name panel-hint'}>{label}</span>
      {asset && (
        <button type="button" className="toolbar-button" onClick={() => on_change('')}>
          {clear_label}
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
        <AssetField
          store={useAssetStore}
          asset={value.texture}
          placeholder="Drop an image here"
          on_change={(texture) => on_change({ ...value, texture })}
        />
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

const body_types: { value: BodyType; label: string }[] = [
  { value: 'static', label: 'Static' },
  { value: 'kinematic', label: 'Kinematic' },
  { value: 'dynamic', label: 'Dynamic' },
]

function RigidbodyFields({ value, on_change }: { value: Rigidbody; on_change: (value: Rigidbody) => void }) {
  return (
    <>
      <Row label="Type">
        <SelectField
          label="Type"
          value={value.type}
          options={body_types}
          on_change={(type) => on_change({ ...value, type })}
        />
      </Row>
      <Row label="Gravity">
        <NumberField
          label="×"
          value={value.gravity_scale}
          on_change={(gravity_scale) => on_change({ ...value, gravity_scale })}
        />
      </Row>
      <Row label="Fixed rotation">
        <CheckboxField
          label="Fixed rotation"
          value={value.fixed_rotation}
          on_change={(fixed_rotation) => on_change({ ...value, fixed_rotation })}
        />
      </Row>
    </>
  )
}

const collider_shapes: { value: ColliderShape; label: string }[] = [
  { value: 'box', label: 'Box' },
  { value: 'circle', label: 'Circle' },
]

function ColliderFields({ value, on_change }: { value: Collider; on_change: (value: Collider) => void }) {
  return (
    <>
      <Row label="Shape">
        <SelectField
          label="Shape"
          value={value.shape}
          options={collider_shapes}
          on_change={(shape) => on_change({ ...value, shape })}
        />
      </Row>
      {value.shape === 'box' ? (
        <Row label="Size">
          <VectorFields labels={['W', 'H']} values={value.size} on_change={(size) => on_change({ ...value, size })} />
        </Row>
      ) : (
        <Row label="Radius">
          <NumberField label="R" value={value.radius} on_change={(radius) => on_change({ ...value, radius })} />
        </Row>
      )}
      <Row label="Offset">
        <VectorFields
          labels={['X', 'Y']}
          values={value.offset}
          on_change={(offset) => on_change({ ...value, offset })}
        />
      </Row>
      <Row label="Density">
        <NumberField label="kg/m²" value={value.density} on_change={(density) => on_change({ ...value, density })} />
      </Row>
      <Row label="Friction">
        <NumberField label="μ" value={value.friction} on_change={(friction) => on_change({ ...value, friction })} />
      </Row>
      <Row label="Bounce">
        <NumberField
          label="e"
          value={value.restitution}
          on_change={(restitution) => on_change({ ...value, restitution })}
        />
      </Row>
      <Row label="Sensor">
        <CheckboxField label="Sensor" value={value.sensor} on_change={(sensor) => on_change({ ...value, sensor })} />
      </Row>
    </>
  )
}

function AnimatorFields({ value, on_change }: { value: Animator; on_change: (value: Animator) => void }) {
  return (
    <>
      <Row label="Animation set">
        <AssetField
          store={useAssetStore}
          asset={value.animation_set}
          placeholder="Drop an animation set here"
          on_change={(animation_set) => on_change({ ...value, animation_set })}
        />
      </Row>
      <label className="inspector-row">
        <span className="inspector-label">Clip</span>
        <input
          className="inspector-name"
          value={value.clip}
          onChange={(event) => on_change({ ...value, clip: event.target.value })}
        />
      </label>
    </>
  )
}

const tilemap_tools: { value: TilemapTool; label: string }[] = [
  { value: 'select', label: 'Select' },
  { value: 'brush', label: 'Brush' },
  { value: 'eraser', label: 'Eraser' },
  { value: 'fill', label: 'Fill' },
]

function TilemapFields({ value, on_change }: { value: Tilemap; on_change: (value: Tilemap) => void }) {
  const tool = useTilemapToolStore((store) => store.tool)
  const stored_layer = useTilemapToolStore((store) => store.layer)
  const { set_tool, set_layer } = useTilemapToolStore.getState()
  // The stored layer may belong to another tilemap with more layers.
  const layer = Math.min(stored_layer, value.layers.length - 1)

  return (
    <>
      <Row label="Tileset">
        <AssetField
          store={useAssetStore}
          asset={value.tileset}
          placeholder="Drop a .tileset.json here"
          accepts={is_tileset_name}
          on_change={(tileset) => on_change({ ...value, tileset })}
        />
      </Row>
      <Row label="Cell size">
        <VectorFields
          labels={['W', 'H']}
          values={value.cell_size}
          on_change={(cell_size) => on_change({ ...value, cell_size })}
        />
      </Row>
      <Row label="Cells">
        <VectorFields
          labels={['W', 'H']}
          values={value.size}
          on_change={([width, height]) =>
            on_change(resize_tilemap(value, [Math.max(1, Math.round(width)), Math.max(1, Math.round(height))]))
          }
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
      <Row label="Layer">
        {value.layers.length > 0 && (
          <SelectField
            label="Layer"
            value={String(layer)}
            options={value.layers.map((_, index) => ({ value: String(index), label: `Layer ${index + 1}` }))}
            on_change={(index) => set_layer(Number(index))}
          />
        )}
        <button
          type="button"
          className="toolbar-button"
          onClick={() => {
            on_change({ ...value, layers: [...value.layers, empty_layer(value.size)] })
            set_layer(value.layers.length)
          }}
        >
          Add
        </button>
        {value.layers.length > 0 && (
          <button
            type="button"
            className="toolbar-button"
            onClick={() => on_change({ ...value, layers: value.layers.filter((_, index) => index !== layer) })}
          >
            Remove
          </button>
        )}
      </Row>
      <Row label="Tool">
        {tilemap_tools.map((option) => (
          <button
            key={option.value}
            type="button"
            className="toolbar-button"
            aria-pressed={tool === option.value}
            onClick={() => set_tool(option.value)}
          >
            {option.label}
          </button>
        ))}
      </Row>
      <TilePalette tileset={value.tileset} />
    </>
  )
}

function ScriptFields({ value, on_change }: { value: Scripts; on_change: (value: Scripts) => void }) {
  return (
    <div className="inspector-list">
      {value.assets.map((asset, index) => (
        <AssetField
          // The same script may be listed twice, so the position tells the rows apart.
          key={index}
          store={useScriptStore}
          asset={asset}
          placeholder="Drop a script here"
          clear_label="Remove"
          on_change={(replacement) =>
            on_change({
              assets: replacement
                ? value.assets.with(index, replacement)
                : value.assets.filter((_, other) => other !== index),
            })
          }
        />
      ))}
      <AssetField
        store={useScriptStore}
        asset=""
        placeholder="Drop a script here to add it"
        on_change={(added) => on_change({ assets: [...value.assets, added] })}
      />
    </div>
  )
}

const component_titles: Record<ComponentName, string> = {
  transform: 'Transform',
  sprite: 'Sprite',
  rigidbody: 'Rigidbody',
  collider: 'Collider',
  animator: 'Animator',
  tilemap: 'Tilemap',
  scripts: 'Scripts',
}

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
  const { transform, sprite, rigidbody, collider, animator, tilemap, scripts } = entity.components
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
      {rigidbody && (
        <ComponentSection name="rigidbody" on_remove={() => set_component('rigidbody', undefined)}>
          <RigidbodyFields value={rigidbody} on_change={(value) => set_component('rigidbody', value)} />
        </ComponentSection>
      )}
      {collider && (
        <ComponentSection name="collider" on_remove={() => set_component('collider', undefined)}>
          <ColliderFields value={collider} on_change={(value) => set_component('collider', value)} />
        </ComponentSection>
      )}
      {animator && (
        <ComponentSection name="animator" on_remove={() => set_component('animator', undefined)}>
          <AnimatorFields value={animator} on_change={(value) => set_component('animator', value)} />
        </ComponentSection>
      )}
      {tilemap && (
        <ComponentSection name="tilemap" on_remove={() => set_component('tilemap', undefined)}>
          <TilemapFields value={tilemap} on_change={(value) => set_component('tilemap', value)} />
        </ComponentSection>
      )}
      {scripts && (
        <ComponentSection name="scripts" on_remove={() => set_component('scripts', undefined)}>
          <ScriptFields value={scripts} on_change={(value) => set_component('scripts', value)} />
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

function SceneInspector({ document }: { document: SceneDocument }) {
  const set_gravity = useSceneStore((store) => store.set_gravity)

  return (
    <section aria-label="Scene">
      <header className="panel-header">
        <h3 className="panel-title">Scene</h3>
      </header>
      <Row label="Gravity">
        <VectorFields labels={['X', 'Y']} values={document.gravity} on_change={set_gravity} />
      </Row>
      <p className="panel-hint">Select an entity to edit it.</p>
    </section>
  )
}

export function Inspector() {
  const document = useSceneStore((store) => store.document)
  const selected = useSceneStore((store) => store.selected)
  const entity = document?.entities.find((candidate) => candidate.id === selected)

  return (
    <section className="panel inspector" aria-label="Inspector">
      {entity && <EntityInspector key={entity.id} entity={entity} />}
      {!entity && document && <SceneInspector document={document} />}
    </section>
  )
}
