import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5850, strictPort: true, host: true },
  preview: { port: 5850, strictPort: true },
});
