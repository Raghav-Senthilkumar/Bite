import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Image discovery runs in the authenticated API and resolved URLs are cached
// by the browser/CDN, so development and production use the same path.
export default defineConfig({
  plugins: [react()],
})
