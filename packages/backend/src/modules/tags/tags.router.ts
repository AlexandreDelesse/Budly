import { Router } from 'express'
import { z } from 'zod'
import db from '../../db'

const router = Router()

const TagCreate = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

// GET /api/tags
router.get('/', async (_req, res, next) => {
  try {
    const tags = await db.tag.findMany({ orderBy: { name: 'asc' } })
    res.json(tags)
  } catch (err) {
    next(err)
  }
})

// POST /api/tags — upsert by name
router.post('/', async (req, res, next) => {
  try {
    const body = TagCreate.parse(req.body)
    const tag = await db.tag.upsert({
      where: { name: body.name },
      update: {},
      create: { name: body.name, ...(body.color ? { color: body.color } : {}) },
    })
    res.status(201).json(tag)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/tags/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await db.tag.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

export default router
