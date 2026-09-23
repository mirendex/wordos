import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'www',
    emptyOutDir: true,
    target: 'es2019',
  },
  test: {
    environment: 'node',
  },
});
