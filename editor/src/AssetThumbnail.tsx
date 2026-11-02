import { useEffect, useState } from 'react'
import type { AssetFile } from './project/assets'

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
  return <span className="w-16 h-16 grid place-items-center rounded bg-control text-text-muted text-xs uppercase">{extension(file.name) || 'file'}</span>
}
