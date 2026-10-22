import { useEffect, useRef } from 'react'

type RenameInputProps = {
  name: string
  on_commit: (new_name: string) => void
  on_cancel: () => void
}

export function RenameInput({ name, on_commit, on_cancel }: RenameInputProps) {
  const input = useRef<HTMLInputElement>(null)
  // Escape and Enter both end editing, after which the input's blur must not commit a second time.
  const finished = useRef(false)

  useEffect(() => {
    const element = input.current
    if (!element) {
      return
    }
    element.focus()
    // Select only the part before the extension, so typing keeps the file type.
    const dot = name.lastIndexOf('.')
    element.setSelectionRange(0, dot > 0 ? dot : name.length)
  }, [name])

  function finish(commit: boolean) {
    if (finished.current) {
      return
    }
    finished.current = true
    if (commit && input.current) {
      on_commit(input.current.value.trim())
    } else {
      on_cancel()
    }
  }

  return (
    <input
      ref={input}
      className="rename-input"
      aria-label={`New name for ${name}`}
      defaultValue={name}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          finish(true)
        } else if (event.key === 'Escape') {
          finish(false)
        }
      }}
      onBlur={() => finish(true)}
    />
  )
}
