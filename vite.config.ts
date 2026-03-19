import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function honoDevServer(): Plugin {
  return {
    name: 'hono-dev-server',
    configureServer(server) {
      // Load all .env vars into process.env for server-side code
      const env = loadEnv('development', process.cwd(), '')
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value
      }

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api') && !req.url?.startsWith('/health')) {
          return next()
        }

        // Dynamically import so Vite handles HMR for server code too
        const { app } = await server.ssrLoadModule('/server/app.ts')
        // Also trigger config validation on first request
        await server.ssrLoadModule('/server/config.ts')

        const url = new URL(req.url, `http://${req.headers.host}`)
        const headers = new Headers()
        for (const [key, value] of Object.entries(req.headers)) {
          if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
        }

        // Read request body for POST/PUT/PATCH
        let body: string | undefined
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          body = await new Promise<string>((resolve) => {
            let data = ''
            req.on('data', (chunk: Buffer) => (data += chunk.toString()))
            req.on('end', () => resolve(data))
          })
        }

        const request = new Request(url.toString(), {
          method: req.method,
          headers,
          body,
        })

        const response = await app.fetch(request)
        res.statusCode = response.status
        response.headers.forEach((value: string, key: string) => {
          res.setHeader(key, value)
        })
        const text = await response.text()
        res.end(text)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), honoDevServer()],
})
