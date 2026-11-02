import { useEffect } from 'react'
import { useProjectStore } from './project/project_store'
import { ProjectPicker } from './ProjectPicker'
import { Workspace } from './Workspace'

export default function App() {
  const state = useProjectStore((store) => store.state)
  const restore = useProjectStore((store) => store.restore)

  useEffect(() => {
    void restore()
  }, [restore])

  return (
    <main className="grid grid-rows-[minmax(0,1fr)] grid-cols-[minmax(0,1fr)] h-full">
      {state.status === 'open' ? <Workspace project={state.directory} /> : <ProjectPicker />}
    </main>
  )
}
