import { useEffect } from 'react'
import { use_project_store } from './project/project_store'
import { ProjectPicker } from './ProjectPicker'
import { Workspace } from './Workspace'

export default function App() {
  const state = use_project_store((store) => store.state)
  const restore = use_project_store((store) => store.restore)

  useEffect(() => {
    void restore()
  }, [restore])

  return (
    <main className="editor">
      {state.status === 'open' ? <Workspace project={state.directory} /> : <ProjectPicker />}
    </main>
  )
}
