import { Router } from 'express'
import { z } from 'zod'
import db from '../../db'

const router = Router()

const MerchantPatch = z.object({
  categoryId: z.string().nullable().optional(),
  expenseType: z.enum(['FIXED_RECURRING', 'VARIABLE_RECURRING', 'ONE_TIME', 'UNKNOWN']).optional(),
  displayName: z.string().max(80).nullable().optional(),
})

// GET /api/merchants
router.get('/', async (req, res, next) => {
  try {
    const uncategorizedOnly = req.query.uncategorized === 'true'
    const merchants = await db.merchant.findMany({
      where: uncategorizedOnly ? { categoryId: null } : undefined,
      include: { category: { select: { id: true, name: true, color: true, icon: true } } },
      orderBy: { name: 'asc' },
    })
    res.json(merchants)
  } catch (err) {
    next(err)
  }
})

// PATCH /api/merchants/:id
// Updates the merchant and propagates categoryId + expenseType to all linked
// non-manual transactions (the "rule application" mechanic).
router.patch('/:id', async (req, res, next) => {
  try {
    const body = MerchantPatch.parse(req.body)

    const merchant = await db.merchant.update({
      where: { id: req.params.id },
      data: {
        ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
        ...(body.expenseType !== undefined && { expenseType: body.expenseType }),
        ...(body.displayName !== undefined && { displayName: body.displayName }),
      },
      include: { category: { select: { id: true, name: true, color: true, icon: true } } },
    })

    // Propagate to all transactions linked to this merchant that were not
    // manually overridden.
    const propagate: Record<string, unknown> = {}
    if (body.categoryId !== undefined) propagate.categoryId = body.categoryId
    if (body.expenseType !== undefined) propagate.expenseType = body.expenseType

    if (Object.keys(propagate).length > 0) {
      await db.transaction.updateMany({
        where: { merchantId: req.params.id, isManual: false },
        data: propagate,
      })
    }

    res.json(merchant)
  } catch (err) {
    next(err)
  }
})

export default router
