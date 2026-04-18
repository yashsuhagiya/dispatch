import { Hono } from 'hono'
import { listTemplates, getTemplate } from '../services/templatesService'

const templateRoutes = new Hono()

templateRoutes.get('/templates', (c) => {
  return c.json(listTemplates())
})

templateRoutes.get('/templates/:id', (c) => {
  const t = getTemplate(c.req.param('id'))
  if (!t) return c.json({ error: 'Template not found' }, 404)
  return c.json(t)
})

export { templateRoutes }
