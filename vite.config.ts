import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    watch: {
      // Windows 上正在写入的交付包可能被独占，不纳入源码监听。
      ignored: ['**/artifacts/**'],
    },
  },
});
