import { useEffect, useState } from 'react'
import type { AssetFile } from './project/assets'
import { is_scene_file } from './project/scenes'

const image_extensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'])

function extension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export function is_image_file(name: string) {
  return image_extensions.has(extension(name))
}

export function AssetThumbnail({ file }: { file: AssetFile }) {
  const [url, set_url] = useState<string>()
  const is_image = image_extensions.has(extension(file.name))
  const is_scene = is_scene_file(file.name)

  useEffect(() => {
    if (!is_image) {
      return
    }
    let object_url: string | undefined
    let cancelled = false
    void file.handle.getFile().then((blob) => {
      if (!cancelled) {
        object_url = URL.createObjectURL(blob)
        set_url(object_url)
      }
    })
    return () => {
      cancelled = true
      if (object_url) {
        URL.revokeObjectURL(object_url)
      }
    }
  }, [file.handle, is_image])

  if (url) {
    return <img className="w-16 h-16 object-contain [image-rendering:pixelated]" src={url} alt="" draggable={false} />
  }

  if (is_scene) {
    return (
      <span className="w-16 h-16 flex flex-col items-center justify-center rounded bg-control text-accent border border-accent/25 hover:border-accent/60 transition-colors gap-1">
        <svg
          className="w-6 h-6 stroke-current fill-none"
          viewBox="0 0 24 24"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z" />
          <path d="m4 10 4-4" />
          <path d="m10 10 4-4" />
          <path d="m16 10 4-4" />
          <line x1="4" y1="10" x2="20" y2="10" />
        </svg>
        <span className="text-[9px] font-bold tracking-wider text-accent uppercase">SCENE</span>
      </span>
    )
  }

  return <span className="w-16 h-16 grid place-items-center rounded bg-control text-text-muted text-xs uppercase">{extension(file.name) || 'file'}</span>
}
