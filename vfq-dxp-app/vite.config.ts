import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// One app, one codebase. The three dev servers (web 5173, tablet 5174, mobile 5175 - see package.json) are only separate
// addresses for opening and testing each device view side by side; nothing here or in the app depends on the port, and the
// layout and behaviour adapt to the real viewport and device. Each port gets its own dependency cache (cacheDir) so servers
// started together don't race to pre-bundle into one shared folder, and a fixed port (strictPort) so a view never moves.
const port = process.env.PORT ? Number(process.env.PORT) : 5173
const publicBase = '/vfq-dxp-app/'
const publicBaseWithoutSlash = publicBase.replace(/\/$/, '')

function basePathCompatibility(figmaPreview: boolean): Plugin {
  return {
    name: 'base-path-compatibility',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const [pathname, query] = (req.url ?? '').split('?', 2)
        if (figmaPreview && (pathname === publicBaseWithoutSlash || pathname.startsWith(publicBase))) {
          const previewPath = pathname.slice(publicBaseWithoutSlash.length) || '/'
          res.statusCode = 302
          res.setHeader('Location', `${previewPath}${query ? `?${query}` : ''}`)
          res.end()
          return
        }
        if (!figmaPreview && pathname === publicBaseWithoutSlash) {
          req.url = `${publicBase}${query ? `?${query}` : ''}`
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const figmaPreview = command === 'serve' && process.env.FIGMA_MAKE_PREVIEW === '1'
  return {
    // Figma preview routes from root. Builds and normal local development keep
    // the published subpath contract.
    base: figmaPreview ? '/' : publicBase,
    plugins: [basePathCompatibility(figmaPreview), react(), tailwindcss()],
    resolve: {
      // Lazy route chunks and the eagerly loaded shell must share one React
      // module identity, including after Vite rebuilds its dependency cache.
      dedupe: ['react', 'react-dom'],
    },
    cacheDir: `node_modules/.vite-${port}`,
    server: {
      port,
      strictPort: true,
      hmr: figmaPreview
        ? {
            protocol: 'wss',
            clientPort: 443,
            path: '/',
          }
        : undefined,
    },
  }
})
