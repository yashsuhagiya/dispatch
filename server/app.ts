import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { emailRoutes } from './routes/email'
import { templateRoutes } from './routes/templates'

const app = new Hono()

app.use('*', cors())
app.use('*', logger())

app.route('/api', emailRoutes)
app.route('/api', templateRoutes)

app.get('/health', (c) => c.json({ ok: true }))

export { app }
