import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            if (err.code === 'ECONNABORTED' || err.message?.includes('ECONNABORTED')) return;
            console.error('WS proxy error:', err);
          });
          proxy.on('proxyReqWs', (_proxyReq, _req, socket) => {
            socket.on('error', (err) => {
              if (err.code === 'ECONNABORTED' || err.message?.includes('ECONNABORTED')) return;
              console.error('WS socket error:', err);
            });
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
