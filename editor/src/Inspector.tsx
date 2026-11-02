import { useState, useEffect, type ReactNode } from 'react'
import { useStore } from 'zustand'
import { useAssetFileDrop } from './asset_drag'
import { find_file_by_id } from './project/assets'
import { is_sound_name } from './project/audio'
import { useAssetStore, useScriptStore, type AssetStoreHook } from './project/asset_store'
import {
  component_defaults,
  type Animator,
  type AudioSource,
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
  type TilemapOrientation,
  type Transform,
  type SpriteLayer,
} from './project/scene_document'
import { useSceneStore } from './project/scene_store'
import { empty_layer, is_tileset_name, resize_tilemap } from './project/tilemap'
import { TilePalette } from './TilePalette'
import { useTilemapToolStore, type TilemapTool } from './tilemap_tool_store'

const input_class =
  'flex-1 min-w-0 px-1 py-0.5 border border-border rounded bg-background text-text text-[0.85rem] focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-1 transition-colors'
const select_class =
  'min-w-0 px-1 py-0.5 border border-border rounded bg-background text-text text-[0.85rem] focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-1 transition-colors cursor-pointer'
const btn_class =
  'px-2 py-0.5 border border-border rounded bg-control text-[0.85rem] shrink-0 hover:bg-control-hover transition-colors cursor-pointer text-inherit aria-pressed:border-accent aria-pressed:text-accent'

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
    <label className="flex flex-1 basis-16 gap-1 items-center min-w-0 text-text-muted text-xs">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={text}
        className={input_class}
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
    <select aria-label={label} value={value} className={select_class} onChange={(event) => on_change(event.target.value as T)}>
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
    <input
      type="checkbox"
      aria-label={label}
      checked={value}
      className="m-0 accent-accent cursor-pointer"
      onChange={(event) => on_change(event.target.checked)}
    />
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 items-center mb-1.5">
      <span className="text-text-muted text-[0.85rem]">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
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
    <div
      className={`flex flex-1 gap-1.5 items-center min-w-0 p-1 border border-dashed rounded text-[0.8rem] ${
        drop.active ? 'border-accent outline-2 outline-accent -outline-offset-2' : 'border-border'
      }`}
      title={file?.path}
      {...drop.handlers}
    >
      <span className={`flex-1 overflow-hidden text-ellipsis whitespace-nowrap ${file ? 'text-text' : 'text-text-muted'}`}>
        {label}
      </span>
      {asset && (
        <button type="button" className={btn_class} onClick={() => on_change('')}>
          {clear_label}
        </button>
      )}
    </div>
  )
}

function SpriteFields({ value, on_change }: { value: Sprite; on_change: (value: Sprite) => void }) {
  const [r, g, b, a] = value.color
  const layers = value.layers || []

  function update_layer(index: number, patch: Partial<SpriteLayer>) {
    on_change({
      ...value,
      layers: layers.map((layer, i) => (i === index ? { ...layer, ...patch } : layer)),
    })
  }

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
          className="w-10 h-6 p-0 border border-border rounded bg-background cursor-pointer"
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
      <div className="flex flex-col gap-1.5">
        {layers.map((layer, index) => (
          <div key={index} className="flex flex-col gap-1.5 p-1.5 border border-border rounded">
            <Row label="Slots">
              <input
                className={input_class}
                placeholder="e.g. hand, pants, helmet"
                value={layer.name}
                onChange={(e) => update_layer(index, { name: e.target.value })}
              />
              <button
                type="button"
                className={btn_class}
                onClick={() => on_change({ ...value, layers: layers.filter((_, i) => i !== index) })}
              >
                Remove
              </button>
            </Row>
            <Row label="Texture">
              <AssetField
                store={useAssetStore}
                asset={layer.texture}
                placeholder="Drop layer image here"
                on_change={(texture) => update_layer(index, { texture })}
              />
            </Row>
            <Row label="Offset">
              <VectorFields
                labels={['X', 'Y']}
                values={layer.offset}
                on_change={(offset) => update_layer(index, { offset })}
              />
            </Row>
            <Row label="Order +">
              <NumberField
                label="#"
                value={layer.order}
                step={1}
                on_change={(order_offset) => update_layer(index, { order: Math.round(order_offset) })}
              />
            </Row>
          </div>
        ))}
      </div>
      <button
        type="button"
        className={btn_class}
        onClick={() =>
          on_change({
            ...value,
            layers: [
              ...layers,
              { name: `layer_${layers.length + 1}`, texture: '', offset: [0, 0], color: [1, 1, 1, 1], order: 1 },
            ],
          })
        }
      >
        Add sprite layer
      </button>
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

type BitmaskFieldProps = {
  label: string
  value: number
  on_change: (value: number) => void
}

function BitmaskField({ label, value, on_change }: BitmaskFieldProps) {
  return (
    <div className="grid grid-cols-8 gap-1 w-full" role="group" aria-label={label}>
      {Array.from({ length: 16 }, (_, i) => {
        const active = (value & (1 << i)) !== 0
        return (
          <button
            key={i}
            type="button"
            className={`inline-flex items-center justify-center h-[1.375rem] p-0 border rounded text-xs font-mono tabular-nums cursor-pointer select-none transition-colors ${
              active
                ? 'border-accent bg-[rgba(122,162,255,0.18)] text-accent font-semibold'
                : 'border-border bg-control text-text-muted hover:bg-control-hover hover:text-text'
            }`}
            aria-pressed={active}
            title={`${label} ${i}: ${active ? 'Enabled' : 'Disabled'}`}
            onClick={() => on_change(value ^ (1 << i))}
          >
            {i}
          </button>
        )
      })}
    </div>
  )
}

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
      <Row label="Layer">
        <BitmaskField
          label="Layer"
          value={value.category_bits ?? 1}
          on_change={(category_bits) => on_change({ ...value, category_bits })}
        />
      </Row>
      <Row label="Mask">
        <BitmaskField
          label="Mask"
          value={value.mask_bits ?? 0xffff}
          on_change={(mask_bits) => on_change({ ...value, mask_bits })}
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
      <label className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 items-center mb-1.5">
        <span className="text-text-muted text-[0.85rem]">Clip</span>
        <input
          className={input_class}
          value={value.clip}
          onChange={(event) => on_change({ ...value, clip: event.target.value })}
        />
      </label>
    </>
  )
}

const tilemap_orientations: { value: TilemapOrientation; label: string }[] = [
  { value: 'orthogonal', label: 'Orthogonal' },
  { value: 'isometric', label: 'Isometric' },
]

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
      <Row label="Orientation">
        <SelectField
          label="Orientation"
          value={value.orientation}
          options={tilemap_orientations}
          on_change={(orientation) => on_change({ ...value, orientation })}
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
          className={btn_class}
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
            className={btn_class}
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
            className={btn_class}
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

type ScriptFieldDef = {
  name: string
  label?: string
  type: 'number' | 'string' | 'boolean' | 'asset' | 'entity'
  min?: number
  max?: number
  step?: number
  default_value?: unknown
}

function parse_script_fields(source: string): ScriptFieldDef[] {
  const fields: ScriptFieldDef[] = []
  const class_match = source.match(/export\s+default\s+class\s+\w+\s+extends\s+Component\s*\{([\s\S]*)/)
  if (!class_match) return fields
  const body = class_match[1]

  const prop_regex =
    /(?:\/\*\*([\s\S]*?)\*\/)?\s*(\w+)\s*(?::\s*([\w<>]+))?\s*(?:=\s*([^;\n]+))?\s*[;\n]/g
  let match: RegExpExecArray | null
  while ((match = prop_regex.exec(body)) !== null) {
    const [, jsdoc, name, type_annot, def_expr] = match
    if (!name || name === 'constructor' || name.startsWith('_')) continue

    let type: ScriptFieldDef['type'] = 'string'
    let min: number | undefined
    let max: number | undefined
    let step: number | undefined
    let label: string | undefined

    if (type_annot) {
      const lower = type_annot.toLowerCase().trim()
      if (lower === 'number') type = 'number'
      else if (lower === 'string') type = 'string'
      else if (lower === 'boolean') type = 'boolean'
      else if (lower === 'entity') type = 'entity'
      else if (lower === 'asset') type = 'asset'
    }

    if (def_expr !== undefined) {
      const trimmed = def_expr.trim()
      if (/^-?\d+(\.\d+)?$/.test(trimmed)) type = 'number'
      else if (trimmed === 'true' || trimmed === 'false') type = 'boolean'
      else if (/^['"`]/.test(trimmed)) type = 'string'
    }

    if (jsdoc) {
      const min_m = jsdoc.match(/@min\s+(-?\d+(?:\.\d+)?)/)
      const max_m = jsdoc.match(/@max\s+(-?\d+(?:\.\d+)?)/)
      const step_m = jsdoc.match(/@step\s+(-?\d+(?:\.\d+)?)/)
      const type_m = jsdoc.match(/@type\s+(\w+)/)
      const label_m = jsdoc.match(/@label\s+([^\n*]+)/)

      if (min_m) min = Number(min_m[1])
      if (max_m) max = Number(max_m[1])
      if (step_m) step = Number(step_m[1])
      if (label_m) label = label_m[1].trim()
      if (type_m) {
        const t = type_m[1].toLowerCase()
        if (t === 'asset' || t === 'entity' || t === 'number' || t === 'string' || t === 'boolean') {
          type = t
        }
      }
    }

    fields.push({
      name,
      label,
      type,
      min,
      max,
      step,
      default_value: def_expr ? def_expr.trim() : undefined,
    })
  }

  return fields
}

function render_field_editor(
  def: ScriptFieldDef,
  val: unknown,
  on_change: (value: unknown) => void,
  all_entities: SceneEntity[],
) {
  if (def.type === 'number') {
    const num = typeof val === 'number' ? val : Number(val) || 0
    if (def.min !== undefined && def.max !== undefined) {
      return (
        <div className="flex gap-2 items-center w-full">
          <input
            type="range"
            min={def.min}
            max={def.max}
            step={def.step ?? (Number.isInteger(def.min) && Number.isInteger(def.max) ? 1 : 0.1)}
            value={num}
            onChange={(e) => on_change(Number(e.target.value))}
            className="flex-1 accent-accent cursor-pointer"
          />
          <NumberField
            label=""
            value={num}
            step={def.step ?? 0.1}
            on_change={(v) => on_change(Math.max(def.min!, Math.min(def.max!, v)))}
          />
        </div>
      )
    }
    return (
      <NumberField
        label=""
        value={num}
        step={def.step ?? 0.1}
        on_change={on_change}
      />
    )
  }

  if (def.type === 'boolean') {
    return (
      <CheckboxField
        label={def.label ?? def.name}
        value={Boolean(val)}
        on_change={on_change}
      />
    )
  }

  if (def.type === 'string') {
    return (
      <input
        className={input_class}
        value={String(val ?? '')}
        onChange={(e) => on_change(e.target.value)}
      />
    )
  }

  if (def.type === 'asset') {
    return (
      <AssetField
        store={useAssetStore}
        asset={String(val ?? '')}
        placeholder="Drop an asset here"
        on_change={on_change}
      />
    )
  }

  if (def.type === 'entity') {
    return (
      <select
        className="w-full h-7 min-w-0 px-1 py-0.5 border border-border rounded bg-background text-text text-[0.85rem] focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-1 transition-colors cursor-pointer"
        value={String(val ?? '')}
        onChange={(e) => on_change(e.target.value)}
      >
        <option value="">(None)</option>
        {all_entities.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name || e.id}
          </option>
        ))}
      </select>
    )
  }

  return null
}

function ScriptItem({
  asset,
  index,
  value,
  on_change,
  all_entities,
}: {
  asset: string
  index: number
  value: Scripts
  on_change: (value: Scripts) => void
  all_entities: SceneEntity[]
}) {
  const root = useScriptStore((store) => store.root)
  const [fields, set_fields] = useState<ScriptFieldDef[]>([])

  useEffect(() => {
    let active = true
    const file = root && asset ? find_file_by_id(root, asset) : undefined
    if (!file) {
      void Promise.resolve().then(() => {
        if (active) set_fields([])
      })
      return () => {
        active = false
      }
    }
    file.handle
      .getFile()
      .then((f) => f.text())
      .then((text) => {
        if (active) {
          set_fields(parse_script_fields(text))
        }
      })
      .catch(() => {
        if (active) set_fields([])
      })
    return () => {
      active = false
    }
  }, [root, asset])

  const script_props = value.properties?.[asset] ?? {}

  function update_prop(prop_name: string, val: unknown) {
    const next_props = {
      ...(value.properties ?? {}),
      [asset]: {
        ...(value.properties?.[asset] ?? {}),
        [prop_name]: val,
      },
    }
    on_change({
      ...value,
      properties: next_props,
    })
  }

  return (
    <div className="flex flex-col gap-1.5 p-1.5 bg-background rounded mb-1">
      <AssetField
        store={useScriptStore}
        asset={asset}
        placeholder="Drop a script here"
        clear_label="Remove"
        on_change={(replacement) => {
          const next_properties = { ...(value.properties ?? {}) }
          if (!replacement) {
            delete next_properties[asset]
          }
          on_change({
            assets: replacement
              ? value.assets.with(index, replacement)
              : value.assets.filter((_, other) => other !== index),
            properties: next_properties,
          })
        }}
      />
      {fields.length > 0 && (
        <div className="mt-1 pl-2 border-l-2 border-border">
          {fields.map((def) => {
            const current_val = script_props[def.name] ?? def.default_value
            return (
              <Row key={def.name} label={def.label ?? def.name}>
                {render_field_editor(def, current_val, (new_val) => update_prop(def.name, new_val), all_entities)}
              </Row>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ScriptFields({ value, on_change }: { value: Scripts; on_change: (value: Scripts) => void }) {
  const all_entities = useSceneStore((store) => store.document?.entities ?? [])

  return (
    <div className="flex flex-col gap-1.5">
      {value.assets.map((asset, index) => (
        <ScriptItem
          key={`${asset}-${index}`}
          asset={asset}
          index={index}
          value={value}
          on_change={on_change}
          all_entities={all_entities}
        />
      ))}
      <AssetField
        store={useScriptStore}
        asset=""
        placeholder="Drop a script here to add it"
        on_change={(added) => on_change({ ...value, assets: [...value.assets, added] })}
      />
    </div>
  )
}

function AudioSourceFields({ value, on_change }: { value: AudioSource; on_change: (value: AudioSource) => void }) {
  return (
    <>
      <Row label="Sound">
        <AssetField
          store={useAssetStore}
          asset={value.sound}
          placeholder="Drop a sound here"
          accepts={is_sound_name}
          on_change={(sound) => on_change({ ...value, sound })}
        />
      </Row>
      <Row label="Volume">
        <NumberField label="×" value={value.volume} on_change={(volume) => on_change({ ...value, volume })} />
      </Row>
      <Row label="Loop">
        <CheckboxField label="Loop" value={value.loop} on_change={(loop) => on_change({ ...value, loop })} />
      </Row>
      <Row label="Play on start">
        <CheckboxField
          label="Play on start"
          value={value.play_on_start}
          on_change={(play_on_start) => on_change({ ...value, play_on_start })}
        />
      </Row>
      <Row label="Spatial">
        <CheckboxField label="Spatial" value={value.spatial} on_change={(spatial) => on_change({ ...value, spatial })} />
      </Row>
    </>
  )
}

const component_titles: Record<ComponentName, string> = {
  transform: 'Transform',
  sprite: 'Sprite',
  rigidbody: 'Rigidbody',
  collider: 'Collider',
  animator: 'Animator',
  audio_source: 'Audio source',
  tilemap: 'Tilemap',
  networked: 'Networked',
  scripts: 'Scripts',
}

type ComponentSectionProps = {
  name: ComponentName
  on_remove: () => void
  // Components without settings, such as networked, show only their header.
  children?: ReactNode
}

function ComponentSection({ name, on_remove, children }: ComponentSectionProps) {
  return (
    <section className="mt-3 pt-2 border-t border-border" aria-label={component_titles[name]}>
      <header className="flex gap-2 items-center justify-between mb-2">
        <h3 className="overflow-hidden m-0 text-[0.9rem] font-semibold text-ellipsis whitespace-nowrap">{component_titles[name]}</h3>
        <button type="button" className={btn_class} onClick={on_remove}>
          Remove
        </button>
      </header>
      {children}
    </section>
  )
}

function EntityInspector({ entity }: { entity: SceneEntity }) {
  const update_entity = useSceneStore((store) => store.update_entity)
  const { transform, sprite, rigidbody, collider, animator, audio_source, tilemap, networked, scripts } =
    entity.components
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
      <label className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 items-center mb-1.5">
        <span className="text-text-muted text-[0.85rem]">Name</span>
        <input
          className={input_class}
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
      {audio_source && (
        <ComponentSection name="audio_source" on_remove={() => set_component('audio_source', undefined)}>
          <AudioSourceFields value={audio_source} on_change={(value) => set_component('audio_source', value)} />
        </ComponentSection>
      )}
      {tilemap && (
        <ComponentSection name="tilemap" on_remove={() => set_component('tilemap', undefined)}>
          <TilemapFields value={tilemap} on_change={(value) => set_component('tilemap', value)} />
        </ComponentSection>
      )}
      {networked && (
        <ComponentSection name="networked" on_remove={() => set_component('networked', undefined)} />
      )}
      {scripts && (
        <ComponentSection name="scripts" on_remove={() => set_component('scripts', undefined)}>
          <ScriptFields value={scripts} on_change={(value) => set_component('scripts', value)} />
        </ComponentSection>
      )}
      {missing.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {missing.map((name) => (
            <button
              key={name}
              type="button"
              className={btn_class}
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
  const set_clear_color = useSceneStore((store) => store.set_clear_color)

  return (
    <section aria-label="Scene">
      <header className="flex gap-2 items-center justify-between mb-2">
        <h3 className="overflow-hidden m-0 text-[0.9rem] font-semibold text-ellipsis whitespace-nowrap">Scene</h3>
      </header>
      <Row label="Gravity">
        <VectorFields labels={['X', 'Y']} values={document.gravity} on_change={set_gravity} />
      </Row>
      <Row label="Clear Color">
        <input
          type="color"
          className="w-10 h-6 p-0 border border-border rounded bg-background cursor-pointer"
          value={document.clear_color}
          onChange={(v) => set_clear_color(v.target.value)}
        />
      </Row>
      <p className="text-text-muted text-sm mt-2">Select an entity to edit it.</p>
    </section>
  )
}

export function Inspector() {
  const document = useSceneStore((store) => store.document)
  const selected = useSceneStore((store) => store.selected)
  const entity = document?.entities.find((candidate) => candidate.id === selected)

  return (
    <section className="overflow-auto min-w-0 p-3 bg-panel" aria-label="Inspector">
      {entity && <EntityInspector key={entity.id} entity={entity} />}
      {!entity && document && <SceneInspector document={document} />}
    </section>
  )
}
