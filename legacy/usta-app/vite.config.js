import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@shared': path.resolve(__dirname, '../app/src'),
        }
    },
    server: {
        port: 5201,
        strictPort: true,
        host: true,
        fs: {
            allow: ['..']
        }
    }
});
