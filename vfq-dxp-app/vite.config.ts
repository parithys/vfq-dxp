import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// One app, one codebase. The three dev servers (web 5173, tablet 5174, mobile 5175 - see package.json) are only separate
// addresses for opening and testing each device view side by side; nothing here or in the app depends on the port, and the
// layout and behaviour adapt to the real viewport and device. Each port gets its own dependency cache (cacheDir) so servers
// started together don't race to pre-bundle into one shared folder, and a fixed port (strictPort) so a view never moves.
const port = process.env.PORT ? Number(process.env.PORT) : 5173

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Tailwind runs through its Vite plugin; ignore postcss.config.mjs (that file is for the Next.js spike only).
  css: { postcss: { plugins: [] } },
  cacheDir: `node_modules/.vite-${port}`,
  server: { port, strictPort: true },
})
