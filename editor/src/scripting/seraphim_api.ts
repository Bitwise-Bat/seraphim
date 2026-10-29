import type { MainModule } from 'seraphim/seraphim.js'
import type { ServerConnection } from '../network/server_connection'
import { create_world_api, type Vec2 } from '../../../runtime/world_api.ts'
import { key_codes, type KeyName, mouse_codes, type MouseName } from './keys'

const SERAPHIM_UI_ID = 'seraphim-ui'

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
    on: (type: string, cb: (data: unknown) => void): void => connection.on(type, cb),
    off: (type: string, cb: (data: unknown) => void): void => connection.off(type, cb),
  }

  function find_entity(name: string): Entity | undefined {
    const id = engine.World.find_entity(name)
    return id ? new Entity(id, name) : undefined
  }

  function create_entity(name: string): Entity {
    const id = engine.World.create_entity(name)
    return new Entity(id, name)
  }

  type UITag = {
    div: HTMLDivElement
    span: HTMLDivElement
    button: HTMLDivElement
    input: HTMLDivElement
    img: HTMLDivElement
    p: HTMLDivElement
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
      if (!element) throw new Error('2')
      main_element.appendChild(element)
      element.id = name
      this.element = element
    }

    public set_style(key: string, value: string) {
      this.element.style.setProperty(key, value)
    }

    get text() {
      return this.element.textContent
    }

    set text(text: string) {
      this.element.textContent = text
    }

    get img(): string {
      if (this.tag !== 'img') throw new Error('This feature only support img tag')
      return (this.element as HTMLImageElement).src
    }

    set img(src: string) {
      if (this.tag !== 'img') {
        throw new Error('This feature only support img tag')
      }
      ;(this.element as HTMLImageElement).src = src
    }

    add_child(elem: ui<any>) {
      this.element.appendChild(elem.element)
    }

    remove_child(elem: ui<any>) {
      if (elem.element.parentElement === this.element) {
        this.element.removeChild(elem.element)
      } else {
        elem.element.remove()
      }
    }

    public remove(elem?: ui<any>) {
      if (elem) {
        elem.element.remove()
        return
      }
      this.element.remove()
    }

    private get main_element() {
      const el = document.getElementById(SERAPHIM_UI_ID)
      if (!el) throw new Error(`UI Main Element didnt exists ${SERAPHIM_UI_ID}`)
      return el
    }
  }

  return {
    ...shared,
    Entity,
    find_entity,
    create_entity,
    camera,
    input,
    net,
    ui,
  }
}
