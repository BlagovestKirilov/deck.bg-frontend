import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    define: {
        // Това заменя всяко извикване на 'global' с 'window'
        global: 'window',
    },
    server: {
        port: 3000,
        proxy: {
            '/api': {
                target: 'https://localhost',
                changeOrigin: true,
                secure: false,
            },
        },
    },
})