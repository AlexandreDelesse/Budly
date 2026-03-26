import { Router } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import db from '../../db'

const router = Router()

function currentMonthStr() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function monthBounds(monthYear: string) {
  const [year, month] = monthYear.split('-').map(Number)
  return {
    start: new Date(year, month - 1, 1),
    end: new Date(year, month, 1),
  }
}

// GET /api/budgets?month=2024-03
// Returns all budgets for the month, enriched with actual spend.
// Also returns categories that have transactions in the month but no budget,
// so the frontend can render "add budget" cards.
router.get('/', async (req, res, next) => {
  try {
    const month = (req.query.month as string) || currentMonthStr()
    const { start, end } = monthBounds(month)

    // All budgets for this month
    const budgets = await db.budget.findMany({
      where: { monthYear: month },
      include: { category: true },
    })

    // Actual spend per category for this month
    const spendGroups = await db.transaction.groupBy({
      by: ['categoryId'],
      where: {
        date: { gte: start, lt: end },
        amount: { lt: 0 },
        categoryId: { not: null },
      },
      _sum: { amount: true },
    })
    const spendMap = new Map(
      spendGroups.map(g => [g.categoryId!, Math.abs(Number(g._sum.amount ?? 0))])
    )

    // Categories that spent this month but have no budget
    const budgetedCategoryIds = new Set(budgets.map(b => b.categoryId))
    const unbudgetedCategoryIds = [...spendMap.keys()].filter(id => !budgetedCategoryIds.has(id))

    const unbudgetedCategories = unbudgetedCategoryIds.length > 0
      ? await db.category.findMany({ where: { id: { in: unbudgetedCategoryIds } } })
      : []

    // Build response
    const budgeted = budgets.map(b => {
      const spent = spendMap.get(b.categoryId) ?? 0
      const cap = Number(b.cap)
      return {
        id: b.id,
        categoryId: b.categoryId,
        monthYear: b.monthYear,
        cap,
        category: b.category,
        spent,
        percentOfBudget: cap > 0 ? Math.round((spent / cap) * 1000) / 10 : null,
      }
    })

    const unbudgeted = unbudgetedCategories.map(cat => ({
      id: null,
      categoryId: cat.id,
      monthYear: month,
      cap: null,
      category: cat,
      spent: spendMap.get(cat.id) ?? 0,
      percentOfBudget: null,
    }))

    // Sort: budgeted by percent desc (most consumed first), then unbudgeted by spend desc
    budgeted.sort((a, b) => (b.percentOfBudget ?? 0) - (a.percentOfBudget ?? 0))
    unbudgeted.sort((a, b) => b.spent - a.spent)

    res.json({ budgeted, unbudgeted, month })
  } catch (err) {
    next(err)
  }
})

const BudgetCreateBody = z.object({
  categoryId: z.string(),
  monthYear: z.string().regex(/^\d{4}-\d{2}$/),
  cap: z.number().positive(),
})

// POST /api/budgets
router.post('/', async (req, res, next) => {
  try {
    const body = BudgetCreateBody.parse(req.body)
    const budget = await db.budget.create({
      data: {
        categoryId: body.categoryId,
        monthYear: body.monthYear,
        cap: new Prisma.Decimal(body.cap),
      },
      include: { category: true },
    })
    res.status(201).json(budget)
  } catch (err) {
    next(err)
  }
})

const BudgetUpdateBody = z.object({
  cap: z.number().positive(),
})

// PUT /api/budgets/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { cap } = BudgetUpdateBody.parse(req.body)
    const budget = await db.budget.update({
      where: { id: req.params.id },
      data: { cap: new Prisma.Decimal(cap) },
      include: { category: true },
    })
    res.json(budget)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/budgets/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await db.budget.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

export default router
