import { useEffect, useId, useRef, useState } from 'react'
import type { AssetFile } from './project/assets.ts'

export function ImagePreviewDialog({ file, on_close }: { file: AssetFile; on_close: VoidFunction }) {
  const dialog_ref = useRef<HTMLDialogElement>(null)
  const title_id = useId()
  const [url, set_url] = useState<string>()
  const [dimensions, set_dimensions] = useState<{ width: number; height: number }>()

  useEffect(() => {
    const dialog = dialog_ref.current
    if (!dialog) return
    if (!dialog.open) {
      dialog.showModal()
    }
    const outside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect()
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
    }
    let pressed_outside = false
    const on_down = (e: PointerEvent) => {
      pressed_outside = outside(e)
    }
    const on_up = (e: PointerEvent) => {
      if (pressed_outside && outside(e)) dialog.close()
    }
    dialog.addEventListener('pointerdown', on_down)
    dialog.addEventListener('pointerup', on_up)
    return () => {
      dialog.removeEventListener('pointerdown', on_down)
      dialog.removeEventListener('pointerup', on_up)
    }
  }, [])

  useEffect(() => {
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
      if (object_url) URL.revokeObjectURL(object_url)
    }
  }, [])

  return (
    <dialog
      ref={dialog_ref}
      className="image-preview-dialog"
      aria-labelledby={title_id}
      onClose={on_close}
      {...({ closedby: 'any' } as Record<string, unknown>)}
    >
      <header className="image-preview-header">
        <h2 id={title_id} className="panel-title">
          {file.name}
          {dimensions && (
            <span className="panel-hint">
              {' '}
              ({dimensions.width} * {dimensions.height})
            </span>
          )}
        </h2>
        <form method="dialog">
          <button type="submit" className="toolbar-button" autoFocus>
            close
          </button>
        </form>
      </header>
      <div className="image-preview-body">
        {url && (
          <img
            src={url}
            alt={file.name}
            className="image-preview-img"
            onLoad={(e) =>
              set_dimensions({
                width: e.currentTarget.naturalWidth,
                height: e.currentTarget.naturalHeight,
              })
            }
          />
        )}
      </div>
    </dialog>
  )
}
