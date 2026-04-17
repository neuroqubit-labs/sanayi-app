import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5200,
        host: true,
        strictPort: true,
        allowedHosts: ['.ngrok-free.dev', 'localhost', '172.17.11.155', '10.255.255.254'],
        hmr: {
            host: '172.17.11.155',
            port: 5200
        }
    }
});
