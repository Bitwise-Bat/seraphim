import type { MainModule } from 'seraphim/seraphim.js'
import type { ServerConnection } from '../network/server_connection'
import { create_world_api, type Vec2 } from '../../../runtime/world_api.ts'
import { key_codes, type KeyName, mouse_codes, type MouseName } from './keys'

const seraphim_ui_id = 'seraphim-ui'

// Everything exported from the module that scripts import as 'seraphim' in the editor: the shared world API plus what
// only exists where the game is shown. Adding a capability means adding it here or in runtime/world_api.ts and declaring
// it in script_types (project/scripts.ts).
export function create_api(engine: MainModule, connection: ServerConnection) {
  const api = engine.Engine
  const shared = create_world_api(engine.World, api.tick_seconds())

  class AudioSource {
    private readonly id: string

    constructor(id: string) {
      this.id = id
    }

    get playing(): boolean {
      return api.is_audio_playing(this.id)
    }

    get volume(): number {
      return api.get_audio_volume(this.id)
    }

    set volume(volume: number) {
      api.set_audio_volume(this.id, volume)
    }

    play(): void {
      api.play_audio(this.id)
    }

    stop(): void {
      api.stop_audio(this.id)
    }
  }

  class Entity extends shared.Entity {
    #audio: AudioSource | undefined | null

    get audio(): AudioSource | undefined {
      this.#audio ??= api.has_audio_source(this.id) ? new AudioSource(this.id) : null
      return this.#audio ?? undefined
    }
  }

  const camera = {
    get position(): Vec2 {
      const { x, y } = api.get_camera() as { x: number; y: number }
      return [x, y]
    },
    set position([x, y]: Vec2) {
      // A view height of -1 keeps the current zoom.
      api.set_camera(x, y, -1)
    },
    get view_height(): number {
      return api.get_camera().view_height as number
    },
    set view_height(view_height: number) {
      const position = api.get_camera()
      api.set_camera(position.x, position.y, view_height)
    },
    screen_to_world(x: number, y: number): { x: number; y: number } {
      return api.screen_to_world(x, y)
    },
    follow(entity: { id: string } | undefined): void {
      api.follow_camera(entity?.id ?? '')
    },
  }

  const input = {
    is_down: (key: KeyName): boolean => api.is_key_down(key_codes[key]),
    was_pressed: (key: KeyName): boolean => api.was_key_pressed(key_codes[key]),
    was_released: (key: KeyName): boolean => api.was_key_released(key_codes[key]),
    is_mouse_down: (button: MouseName): boolean => api.is_mouse_down(mouse_codes[button]),
    was_mouse_pressed: (button: MouseName): boolean => api.was_mouse_pressed(mouse_codes[button]),
    was_mouse_released: (button: MouseName): boolean => api.was_mouse_released(mouse_codes[button]),
    get mouse_position(): Vec2 {
      const position = api.get_mouse_position() as {
        x: number
        y: number
      } | null
      return position ? [position.x, position.y] : [0, 0]
    },
  }

  const net = {
    send: (name: string, data?: unknown): void => connection.send({ type: 'event', name, data }),
    on: (type: string, handler: (data: unknown) => void): void => connection.on(type, handler),
    off: (type: string, handler: (data: unknown) => void): void => connection.off(type, handler),
  }

  function find_entity(name: string): Entity | undefined {
    const id = engine.World.find_entity(name)
    return id ? new Entity(id, name) : undefined
  }

  function create_entity(name: string): Entity {
    const id = engine.World.create_entity(name)
    return new Entity(id, name)
  }
  
  shared.set_asset_url_resolver((id) => engine.Engine.get_asset_url(id))

  async function load_scene(id_or_json: string): Promise<void> {
    let json = id_or_json.trim()
    if (!json.startsWith('{')) {
      const url = engine.Engine.get_asset_url(id_or_json)
      if (!url) {
        throw new Error(`Asset not found: ${id_or_json}`)
      }
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`Failed to fetch scene ${id_or_json} (${res.status} ${res.statusText})`)
      }
      json = await res.text()
    }
    const err = engine.Engine.load_scene(json)
    if (err) {
      throw new Error(`Engine rejected scene: ${err}`)
    }
    shared.notify_scene_loaded(json)
  }

  shared.set_scene_loader(load_scene)

  type UITag = {
    div: HTMLDivElement
    span: HTMLSpanElement
    button: HTMLButtonElement
    input: HTMLInputElement
    img: HTMLImageElement
    p: HTMLParagraphElement
  }

  class ui<K extends keyof UITag> {
    private readonly element: UITag[K]
    private readonly tag: string

    constructor(tag: K, name: string) {
      this.tag = tag

      const main_element = this.main_element
      let element: UITag[K] | null

      element = main_element.querySelector(`#${name}`)
      if (element) {
        this.element = element
        return
      }

      element = document.createElement(this.tag) as UITag[K]
      if (!element) throw new Error(`Could not create <${this.tag}> element`)
      main_element.appendChild(element)
      element.id = name
      this.element = element
    }

    public set_style(key: string, value: string) {
      this.element.style.setProperty(key, value)
    }

    get text() {
      if(this.tag === 'input')
        return (this.element as HTMLInputElement).value
      return this.element.textContent
    }

    set text(text: string) {
      if(this.tag === 'input')
        (this.element as HTMLInputElement).value = text
      else
        this.element.textContent = text
    }

    get img(): string {
      if (this.tag !== 'img') throw new Error('This feature only supports img tag')
      return (this.element as HTMLImageElement).src
    }

    set img(src: string) {
      if (this.tag !== 'img') {
        throw new Error('This feature only supports img tag')
      }
      ;(this.element as HTMLImageElement).src = src
    }

    get input_type(): K extends 'input' ? string : undefined {
      if(this.tag === 'input')
        return (this.element as HTMLInputElement).type as any 
      return undefined as any
    }

    set input_type(value: K extends 'input' ? string : never){
      if(this.tag === 'input')
        (this.element as HTMLInputElement).type = value
    }

    set disabled(value: boolean){
      if(this.tag === 'input' || this.tag === 'button')
        (this.element as HTMLInputElement).disabled = value
    }

    get disabled(){
      if(this.tag === 'input' || this.tag === 'button') 
        return (this.element as HTMLInputElement).disabled
      return false
    }

    add_child(child: ui<any>) {
      this.element.appendChild(child.element)
    }

    remove_child(child: ui<any>) {
      if (child.element.parentElement === this.element) {
        this.element.removeChild(child.element)
      } else {
        child.element.remove()
      }
    }

    on(event: string, handler: (data: unknown) => void){
      this.element.addEventListener(event, handler)
    }

    off(event: string, handler: (data: unknown) => void){
      this.element.removeEventListener(event, handler)
    }

    public remove(target?: ui<any>) {
      if (target) {
        target.element.remove()
        return
      }
      this.element.remove()
    }

    private get main_element() {
      const element = document.getElementById(seraphim_ui_id)
      if (!element) throw new Error(`UI main element does not exist: ${seraphim_ui_id}`)
      return element
    }
  }

  return {
    ...shared,
    load_scene,
    Entity,
    find_entity,
    create_entity,
    camera,
    input,
    net,
    ui,
  }
}
