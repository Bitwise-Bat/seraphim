import { useEffect, useState } from 'react'
import { server_url } from './server_connection'

export function launch_server(project_name: string): void {
  const iframe = document.createElement('iframe')
  iframe.style.display = 'none'
  iframe.src = `seraphim://${encodeURIComponent(project_name)}`
  document.body.appendChild(iframe)
  setTimeout(() => iframe.remove(), 2000)
}

export function stop_server(): void {
  const iframe = document.createElement('iframe')
  iframe.style.display = 'none'
  iframe.src = 'seraphim://stop'
  document.body.appendChild(iframe)
  setTimeout(() => iframe.remove(), 2000)
}

export function useServerStatus() {
  const [is_running, set_is_running] = useState(false)

  useEffect(() => {
    let socket: WebSocket | null = null
    let disposed = false

    function connect() {
      if (disposed) return
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        return
      }

      socket = new WebSocket(server_url)

      socket.onopen = () => set_is_running(true)
      socket.onclose = () => {
        set_is_running(false)
        socket = null
      }
      socket.onerror = () => {
        set_is_running(false)
        socket?.close()
        socket = null
      }
    }

    connect()

    const interval = setInterval(connect, 1000)

    return () => {
      disposed = true
      clearInterval(interval)
      socket?.close()
    }
  }, [])

  return { is_running }
}
