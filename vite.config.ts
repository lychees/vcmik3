import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/vcmik3/',
  server: {
    host: '127.0.0.1',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'] },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/game/**/*.test.ts'],
  },
});
