import { useProjectStore } from './project/project_store'

export function ProjectPicker() {
  const state = useProjectStore((store) => store.state)
  const open = useProjectStore((store) => store.open)
  const create = useProjectStore((store) => store.create)
  const reopen = useProjectStore((store) => store.reopen)

  const btn_class =
    'px-4 py-2 border border-border rounded-md bg-control hover:bg-control-hover cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2'

  if (state.status === 'unsupported') {
    return (
      <section className="place-self-center max-w-lg p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Seraphim Editor</h1>
        <p className="text-text-muted">
          The editor stores projects in a folder on your computer, which only Chromium-based browsers allow. Please
          open it in Chrome, Edge or another Chromium-based browser.
        </p>
      </section>
    )
  }

  if (state.status !== 'closed') {
    return null
  }

  return (
    <section className="place-self-center max-w-lg p-8 text-center">
      <h1 className="text-2xl font-bold mb-4">Seraphim Editor</h1>
      {state.error && (
        <p role="alert" className="text-red-400 mb-4">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap gap-3 justify-center mt-4">
        {state.recent && (
          <button type="button" className={btn_class} onClick={() => void reopen()}>
            Reopen {state.recent.name}
          </button>
        )}
        <button type="button" className={btn_class} onClick={() => void open()}>
          Open project
        </button>
        <button type="button" className={btn_class} onClick={() => void create()}>
          New project
        </button>
      </div>
    </section>
  )
}
