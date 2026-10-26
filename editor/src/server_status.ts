import {useEffect, useState} from "react";

export function useServerStatus(){
    const [is_running, set_is_running] = useState(false)

    useEffect(() => {
        let socket: WebSocket | null = null
        let disposed = false
        
        function connect() {
            if (disposed) return
            if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)){
                return;
            }
            
            socket = new WebSocket('ws://localhost:9001');
            
            socket.onopen = () => set_is_running(true);
            socket.onclose = () => {
                set_is_running(false)
                socket = null
            }
            socket.onerror = () => {
                set_is_running(false)
                socket?.close();
                socket = null;
            }
        }
        
        connect()
        
        const interval = setInterval(connect, 1000)
    
        return () => {
            disposed = false
            clearInterval(interval)
            socket?.close()
        }
    }, [])
    
    
    return {is_running}
}