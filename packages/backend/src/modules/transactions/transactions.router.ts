import { Router } from 'express'
import { z } from 'zod'
import db from '../../db'

const router = Router()

const TransactionPatch = z.object({
  categoryId: z.string().nullable().optional(),
  expenseType: z.enum(['FIXED_RECURRING', 'VARIABLE_RECURRING', 'ONE_TIME', 'UNKNOWN']).optional(),
})

// GET /api/transactions/uncategorized/grouped
// Returns merchants that have at least one uncategorized transaction,
// with count, total amount, and a sample of raw labels.
router.get('/uncategorized/grouped', async (_req, res, next) => {
  try {
    // Find all merchants that have uncategorized transactions
    const groups = await db.transaction.groupBy({
      by: ['merchantId'],
      where: { categoryId: null, merchantId: { not: null } },
      _count: { id: true },
      _sum: { amount: true },
    })

    if (groups.length === 0) {
      res.json([])
      return
    }

    const merchantIds = groups.map(g => g.merchantId!)

    // Load merchant info
    const merchants = await db.merchant.findMany({
      where: { id: { in: merchantIds } },
      select: { id: true, name: true, displayName: true, categoryId: true, expenseType: true },
    })
    const merchantMap = new Map(merchants.map(m => [m.id, m]))

    // Load 3 sample labels per merchant
    const samples = await Promise.all(
      merchantIds.map(mid =>
        db.transaction.findMany({
          where: { merchantId: mid, categoryId: null },
          select: { label: true },
          distinct: ['label'],
          take: 3,
          orderBy: { date: 'desc' },
        })
      )
    )
    const sampleMap = new Map(merchantIds.map((mid, i) => [mid, samples[i].map(s => s.label)]))

    const result = groups.map(g => {
      const merchant = merchantMap.get(g.merchantId!)
      return {
        merchantId: g.merchantId,
        merchantName: merchant?.displayName ?? merchant?.name ?? g.merchantId,
        transactionCount: g._count.id,
        totalAmount: g._sum.amount,
        sampleLabels: sampleMap.get(g.merchantId!) ?? [],
        categoryId: merchant?.categoryId ?? null,
        expenseType: merchant?.expenseType ?? 'UNKNOWN',
      }
    })

    // Sort by transaction count descending (most to categorize first)
    result.sort((a, b) => b.transactionCount - a.transactionCount)

    res.json(result)
  } catch (err) {
    next(err)
  }
})

// GET /api/transactions
router.get('/', async (req, res, next) => {
  try {
    const { month, categoryId, uncategorized, page = '1', limit = '50' } = req.query as Record<string, string>

    const where: Record<string, unknown> = {}

    if (month) {
      const [year, m] = month.split('-').map(Number)
      where.date = {
        gte: new Date(year, m - 1, 1),
        lt: new Date(year, m, 1),
      }
    }
    if (categoryId) where.categoryId = categoryId
    if (uncategorized === 'true') where.categoryId = null

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where,
        include: {
          merchant: { select: { id: true, name: true, displayName: true } },
          category: { select: { id: true, name: true, color: true, icon: true } },
        },
        orderBy: { date: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      db.transaction.count({ where }),
    ])

    res.json({ transactions, total, page: parseInt(page), limit: parseInt(limit) })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/transactions/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const body = TransactionPatch.parse(req.body)
    const transaction = await db.transaction.update({
      where: { id: req.params.id },
      data: {
        ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
        ...(body.expenseType !== undefined && { expenseType: body.expenseType }),
        isManual: true, // manual override — won't be overwritten by future merchant propagations
      },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
      },
    })
    res.json(transaction)
  } catch (err) {
    next(err)
  }
})

export default router
