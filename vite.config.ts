import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    define: {
        // Това заменя всяко извикване на 'global' с 'window'
        global: 'window',
    },
    server: {
        // Pinned: the backend's dev profile allows exactly http://localhost:3000
        // for the WebSocket handshake, so another port breaks the socket.
        port: 3000,
    },
})