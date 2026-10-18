import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// One app, one codebase. The three dev servers (web 5173, tablet 5174, mobile 5175 - see package.json) are only separate
// addresses for opening and testing each device view side by side; nothing here or in the app depends on the port, and the
// layout and behaviour adapt to the real viewport and device. Each port gets its own dependency cache (cacheDir) so servers
// started together don't race to pre-bundle into one shared folder, and a fixed port (strictPort) so a view never moves.
const port = process.env.PORT ? Number(process.env.PORT) : 5173
const figmaPublicUrl = process.env.FIGMA_PUBLIC_URL
const figmaHmrHost = figmaPublicUrl
  ? new URL(figmaPublicUrl.includes('://') ? figmaPublicUrl : `https://${figmaPublicUrl}`).hostname
  : undefined
const appBase = '/vfq-dxp-app/'
const appBaseWithoutSlash = appBase.replace(/\/$/, '')

// Vite's built-in base guard returns a 404 help page for the mount point
// without its trailing slash. Figma's public proxy canonicalizes the slash
// form back to the no-slash form, so an HTTP redirect would loop. Rewrite the
// request internally and let the browser keep either URL.
const basePathRewrite: Plugin = {
  name: 'base-path-rewrite',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const [pathname, query] = (req.url ?? '').split('?', 2)
      if (pathname !== appBaseWithoutSlash) {
        next()
        return
      }
      req.url = `${appBase}${query ? `?${query}` : ''}`
      next()
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  base: appBase,
  plugins: [basePathRewrite, react(), tailwindcss()],
  resolve: {
    // Lazy route chunks and the eagerly loaded shell must share one React
    // module identity, including after Vite rebuilds its dependency cache.
    dedupe: ['react', 'react-dom'],
  },
  cacheDir: `node_modules/.vite-${port}`,
  server: {
    port,
    strictPort: true,
    hmr: process.env.FIGMA
      ? {
          protocol: 'wss',
          clientPort: 443,
          ...(figmaHmrHost ? { host: figmaHmrHost } : {}),
        }
      : undefined,
  },
})
