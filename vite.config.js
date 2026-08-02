import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      external: [
        '@react-native-ml-kit/text-recognition',
        'react-native',
        'react-native-document-scanner-plugin',
        'react-native-svg',
        'react-native-webview'
      ]
    }
  }
})

