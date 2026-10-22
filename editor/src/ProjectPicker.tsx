import { use_project_store } from './project/project_store'

export function ProjectPicker() {
  const state = use_project_store((store) => store.state)
  const open = use_project_store((store) => store.open)
  const create = use_project_store((store) => store.create)
  const reopen = use_project_store((store) => store.reopen)

  if (state.status === 'unsupported') {
    return (
      <section className="project-picker">
        <h1>Seraphim Editor</h1>
        <p>
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
    <section className="project-picker">
      <h1>Seraphim Editor</h1>
      {state.error && <p role="alert">{state.error}</p>}
      <div className="project-picker-actions">
        {state.recent && (
          <button type="button" onClick={() => void reopen()}>
            Reopen {state.recent.name}
          </button>
        )}
        <button type="button" onClick={() => void open()}>
          Open project
        </button>
        <button type="button" onClick={() => void create()}>
          New project
        </button>
      </div>
    </section>
  )
}
