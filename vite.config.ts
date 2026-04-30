import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 카메라 테스트할 때 모바일에서도 접속 가능
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
