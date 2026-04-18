import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import {
  listTemplates,
  getTemplate,
  createTemplate,
  saveTemplate,
  TemplateError,
} from '../services/templatesService'

const templateRoutes = new Hono()

const createSchema = z.object({
  id: z.string().min(1).max(50),
  subject: z.string().max(512),
  body: z.string().max(60_000),
})

const saveSchema = z.object({
  subject: z.string().max(512),
  body: z.string().max(60_000),
})

templateRoutes.get('/templates', (c) => c.json(listTemplates()))

templateRoutes.get('/templates/:id', (c) => {
  const t = getTemplate(c.req.param('id'))
  if (!t) return c.json({ error: 'Template not found' }, 404)
  return c.json(t)
})

templateRoutes.post('/templates', zValidator('json', createSchema), (c) => {
  const { id, subject, body } = c.req.valid('json')
  try {
    const t = createTemplate(id, subject, body)
    return c.json(t, 201)
  } catch (err) {
    if (err instanceof TemplateError) return c.json({ error: err.message }, err.status as 400 | 404 | 409 | 413)
    console.error('[templates POST] unexpected:', err)
    return c.json({ error: 'Internal error' }, 500)
  }
})

templateRoutes.put('/templates/:id', zValidator('json', saveSchema), (c) => {
  const { subject, body } = c.req.valid('json')
  const id = c.req.param('id')
  try {
    const t = saveTemplate(id, subject, body)
    return c.json(t)
  } catch (err) {
    if (err instanceof TemplateError) return c.json({ error: err.message }, err.status as 400 | 404 | 409 | 413)
    console.error('[templates PUT] unexpected:', err)
    return c.json({ error: 'Internal error' }, 500)
  }
})

export { templateRoutes }
