/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  publicDir: false,
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: 'es2021',
    sourcemap: false,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/unit/setup.ts'],
    css: false,
  },
});