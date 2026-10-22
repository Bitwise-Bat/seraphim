import { useEffect } from 'react'
import { use_project_store } from './project/project_store'
import { ProjectPicker } from './ProjectPicker'
import { Viewport } from './Viewport'

export default function App() {
  const status = use_project_store((store) => store.state.status)
  const restore = use_project_store((store) => store.restore)

  useEffect(() => {
    void restore()
  }, [restore])

  return <main className="editor">{status === 'open' ? <Viewport /> : <ProjectPicker />}</main>
}
