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
  }, [file.handle])

  return (
    <dialog
      ref={dialog_ref}
      className="open:flex flex-col gap-3 max-w-[min(85vw,64rem)] max-h-[85vh] p-3 border border-border rounded-lg bg-panel text-text shadow-[0_12px_32px_rgba(0,0,0,0.6)] backdrop:bg-black/65 backdrop:backdrop-blur-[2px] overscroll-contain"
      aria-labelledby={title_id}
      onClose={on_close}
      {...({ closedby: 'any' } as Record<string, unknown>)}
    >
      <header className="flex gap-4 items-center justify-between">
        <h2 id={title_id} className="overflow-hidden m-0 text-[0.9rem] font-semibold text-ellipsis whitespace-nowrap">
          {file.name}
          {dimensions && (
            <span className="text-text-muted">
              {' '}
              ({dimensions.width} * {dimensions.height})
            </span>
          )}
        </h2>
        <form method="dialog">
          <button
            type="submit"
            className="px-2 py-0.5 border border-border rounded bg-control text-[0.85rem] shrink-0 hover:bg-control-hover transition-colors cursor-pointer text-inherit"
            autoFocus
          >
            close
          </button>
        </form>
      </header>
      <div className="grid place-items-center overflow-auto min-w-64 min-h-48 p-4 rounded-md checkerboard-pattern">
        {url && (
          <img
            src={url}
            alt={file.name}
            className="max-w-[75vw] max-h-[70vh] w-auto h-auto min-w-32 object-contain [image-rendering:pixelated]"
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
