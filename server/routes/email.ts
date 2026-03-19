import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { send } from '../services/emailService'
import { append, read } from '../services/historyService'

const emailRoutes = new Hono()

const sendSchema = z.object({
  to: z.string().email('Must be a valid email address'),
})

const sendBulkSchema = z.object({
  recipients: z.array(z.string().email('Must be a valid email address')).min(1),
})

emailRoutes.post('/send', zValidator('json', sendSchema), async (c) => {
  const { to } = c.req.valid('json')
  const result = await send(to)

  await append({
    to,
    timestamp: new Date().toISOString(),
    status: result.success ? 'sent' : 'failed',
    messageId: result.messageId,
    error: result.error,
  })

  return c.json(result, result.success ? 200 : 500)
})

emailRoutes.post('/send-bulk', zValidator('json', sendBulkSchema), async (c) => {
  const { recipients } = c.req.valid('json')
  const results: { to: string; success: boolean; error?: string }[] = []

  for (const to of recipients) {
    const result = await send(to)
    await append({
      to,
      timestamp: new Date().toISOString(),
      status: result.success ? 'sent' : 'failed',
      messageId: result.messageId,
      error: result.error,
    })
    results.push({ to, success: result.success, error: result.error })
  }

  const sent = results.filter((r) => r.success).length
  return c.json({ results, sent, failed: results.length - sent })
})

emailRoutes.get('/history', async (c) => {
  const history = await read()
  return c.json(history)
})

export { emailRoutes }
