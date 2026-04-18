import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { send } from '../services/emailService'
import { append, read } from '../services/historyService'
import { getTemplate } from '../services/templatesService'
import { substitute } from '../lib/tokens'

const emailRoutes = new Hono()

const tokensSchema = z.record(z.string(), z.string()).optional()

const sendSchema = z.object({
  to: z.string().email('Must be a valid email address'),
  templateId: z.string().optional(),
  tokens: tokensSchema,
  parentId: z.string().optional(),
  threadIndex: z.number().int().nonnegative().optional(),
})

const sendBulkSchema = z.object({
  recipients: z.array(z.string().email('Must be a valid email address')).min(1),
  templateId: z.string().optional(),
  tokens: tokensSchema,
})

/** Resolve {subject, body} for a given template+tokens, with a sensible fallback. */
function resolveContent(templateId: string | undefined, tokens: Record<string, string> = {}) {
  if (!templateId) return { subject: undefined, body: undefined, resolvedTemplateId: undefined as string | undefined }
  const t = getTemplate(templateId)
  if (!t) return { subject: undefined, body: undefined, resolvedTemplateId: undefined }
  return {
    subject: substitute(t.subject, tokens),
    body: substitute(t.body, tokens),
    resolvedTemplateId: t.id,
  }
}

emailRoutes.post('/send', zValidator('json', sendSchema), async (c) => {
  const { to, templateId, tokens, parentId, threadIndex } = c.req.valid('json')
  const { subject, body, resolvedTemplateId } = resolveContent(templateId, tokens)
  const result = await send(to, { subject, body })

  await append({
    to,
    timestamp: new Date().toISOString(),
    status: result.success ? 'sent' : 'failed',
    messageId: result.messageId,
    error: result.error,
    templateId: resolvedTemplateId,
    subject,
    tokens: tokens && Object.keys(tokens).length > 0 ? tokens : undefined,
    parentId,
    threadIndex,
  })

  return c.json(result, result.success ? 200 : 500)
})

emailRoutes.post('/send-bulk', zValidator('json', sendBulkSchema), async (c) => {
  const { recipients, templateId, tokens } = c.req.valid('json')
  const { subject, body, resolvedTemplateId } = resolveContent(templateId, tokens)
  const results: { to: string; success: boolean; error?: string }[] = []

  for (const to of recipients) {
    const result = await send(to, { subject, body })
    await append({
      to,
      timestamp: new Date().toISOString(),
      status: result.success ? 'sent' : 'failed',
      messageId: result.messageId,
      error: result.error,
      templateId: resolvedTemplateId,
      subject,
      tokens: tokens && Object.keys(tokens).length > 0 ? tokens : undefined,
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
