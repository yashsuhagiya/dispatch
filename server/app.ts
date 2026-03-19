import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { emailRoutes } from './routes/email'

const app = new Hono()

app.use('*', cors())
app.use('*', logger())

app.route('/api', emailRoutes)

app.get('/health', (c) => c.json({ ok: true }))

export { app }
