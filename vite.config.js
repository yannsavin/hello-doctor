import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',
  base: './', // relative paths: works at https://<user>.github.io/<repo>/
  envDir: '..', // read .env from the project root
  plugins: [react()],
  server: { port: 5173 },
  build: { outDir: '../dist', emptyOutDir: true },
});
