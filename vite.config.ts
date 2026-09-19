import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router'],
          'excel-vendor': ['exceljs'],
          'supabase-vendor': ['@supabase/supabase-js'],
        }
      }
    }
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022',
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/services/infrastructure/__tests__/setup.ts'],
  },
})
