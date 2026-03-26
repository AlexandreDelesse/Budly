import { Router } from 'express'
import { z } from 'zod'
import db from '../../db'

const router = Router()

const CategoryBody = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  icon: z.string().min(1).max(50),
})

// GET /api/categories
router.get('/', async (_req, res, next) => {
  try {
    const categories = await db.category.findMany({ orderBy: { name: 'asc' } })
    res.json(categories)
  } catch (err) {
    next(err)
  }
})

// POST /api/categories
router.post('/', async (req, res, next) => {
  try {
    const body = CategoryBody.parse(req.body)
    const category = await db.category.create({ data: body })
    res.status(201).json(category)
  } catch (err) {
    next(err)
  }
})

// PUT /api/categories/:id
router.put('/:id', async (req, res, next) => {
  try {
    const body = CategoryBody.parse(req.body)
    const category = await db.category.update({
      where: { id: req.params.id },
      data: body,
    })
    res.json(category)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/categories/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const count = await db.transaction.count({
      where: { categoryId: req.params.id },
    })
    if (count > 0) {
      res.status(409).json({
        error: `Cette catégorie est utilisée par ${count} transaction(s). Réassignez-les d'abord.`,
      })
      return
    }
    await db.category.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

export default router
