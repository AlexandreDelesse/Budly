import { Router } from 'express'
import db from '../../db'

const router = Router()

function monthBounds(monthYear: string) {
  const [year, month] = monthYear.split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)
  return { start, end }
}

function prevMonthStr(monthYear: string): string {
  const [year, month] = monthYear.split('-').map(Number)
  const d = new Date(year, month - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function currentMonthStr(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// GET /api/analytics/dashboard?month=2024-03
router.get('/dashboard', async (req, res, next) => {
  try {
    const month = (req.query.month as string) || currentMonthStr()
    const { start, end } = monthBounds(month)
    const prevMonth = prevMonthStr(month)
    const { start: prevStart, end: prevEnd } = monthBounds(prevMonth)

    // All transactions in selected month
    const monthTxs = await db.transaction.findMany({
      where: { date: { gte: start, lt: end } },
      select: { amount: true, categoryId: true, category: { select: { id: true, name: true, color: true, icon: true } } },
    })

    // Cumulative balance: sum of ALL transactions up to end of selected month
    const balanceAgg = await db.transaction.aggregate({
      where: { date: { lt: end } },
      _sum: { amount: true },
    })

    // Previous month total expenses
    const prevTxs = await db.transaction.findMany({
      where: { date: { gte: prevStart, lt: prevEnd } },
      select: { amount: true },
    })

    // Budgets for selected month (also check for a default budget without monthYear)
    const budgets = await db.budget.findMany({
      where: { monthYear: month },
      select: { categoryId: true, cap: true },
    })
    const budgetMap = new Map(budgets.map(b => [b.categoryId, Number(b.cap)]))

    // Aggregate totals
    let totalExpenses = 0
    let totalIncome = 0
    let uncategorizedAmount = 0
    const categoryMap = new Map<string, { name: string; color: string; icon: string; amount: number }>()

    for (const tx of monthTxs) {
      const amount = Number(tx.amount)
      if (amount < 0) totalExpenses += amount
      else totalIncome += amount

      if (!tx.categoryId) {
        uncategorizedAmount += amount
        continue
      }

      const existing = categoryMap.get(tx.categoryId)
      if (existing) {
        existing.amount += amount
      } else {
        categoryMap.set(tx.categoryId, {
          name: tx.category!.name,
          color: tx.category!.color,
          icon: tx.category!.icon,
          amount,
        })
      }
    }

    // Previous month totals
    let prevTotalExpenses = 0
    for (const tx of prevTxs) {
      const amount = Number(tx.amount)
      if (amount < 0) prevTotalExpenses += amount
    }

    const delta =
      prevTotalExpenses !== 0
        ? ((totalExpenses - prevTotalExpenses) / Math.abs(prevTotalExpenses)) * 100
        : null

    // Build byCategory array (expenses only, sorted by absolute amount desc)
    const byCategory = [...categoryMap.entries()]
      .map(([categoryId, data]) => {
        const budget = budgetMap.get(categoryId)
        return {
          categoryId,
          name: data.name,
          color: data.color,
          icon: data.icon,
          amount: data.amount,
          budget: budget ?? null,
          percentOfBudget: budget ? (Math.abs(data.amount) / budget) * 100 : null,
        }
      })
      .filter(c => c.amount < 0) // dashboard shows expenses only
      .sort((a, b) => a.amount - b.amount) // most expensive first

    res.json({
      month,
      balance: Number(balanceAgg._sum.amount ?? 0),
      totalExpenses,
      totalIncome,
      uncategorizedAmount,
      byCategory,
      prevMonth: {
        totalExpenses: prevTotalExpenses,
        delta: delta !== null ? Math.round(delta * 10) / 10 : null,
      },
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/analytics/trends?months=6&categoryIds=a,b,c
router.get('/trends', async (req, res, next) => {
  try {
    const monthCount = Math.min(parseInt((req.query.months as string) || '6'), 12)
    const categoryIdsParam = req.query.categoryIds as string | undefined
    const filterCategoryIds = categoryIdsParam ? categoryIdsParam.split(',').filter(Boolean) : []

    // Build the list of months (oldest → newest)
    const now = new Date()
    const months: string[] = []
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }

    const rangeStart = new Date(now.getFullYear(), now.getMonth() - (monthCount - 1), 1)
    const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    // Fetch expense transactions in range
    const txs = await db.transaction.findMany({
      where: {
        date: { gte: rangeStart, lt: rangeEnd },
        categoryId: { not: null },
        amount: { lt: 0 },
        ...(filterCategoryIds.length > 0 && { categoryId: { in: filterCategoryIds } }),
      },
      select: {
        amount: true,
        date: true,
        categoryId: true,
        category: { select: { id: true, name: true, color: true } },
      },
    })

    // Aggregate: categoryId → monthYear → totalAmount (absolute)
    const catMeta = new Map<string, { name: string; color: string }>()
    const matrix = new Map<string, Map<string, number>>() // categoryId → monthYear → amount

    for (const tx of txs) {
      const catId = tx.categoryId!
      if (!catMeta.has(catId)) {
        catMeta.set(catId, { name: tx.category!.name, color: tx.category!.color })
      }

      const d = tx.date
      const monthYear = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

      if (!matrix.has(catId)) matrix.set(catId, new Map())
      const monthMap = matrix.get(catId)!
      monthMap.set(monthYear, (monthMap.get(monthYear) ?? 0) + Math.abs(Number(tx.amount)))
    }

    // Build series with drift detection
    const series = [...catMeta.entries()].map(([categoryId, meta]) => {
      const monthMap = matrix.get(categoryId) ?? new Map<string, number>()
      const values = months.map(m => Math.round((monthMap.get(m) ?? 0) * 100) / 100)

      // Drift: 3-month avg > 6-month avg * 1.10
      const recent = values.slice(-3).filter(v => v > 0)
      const all = values.filter(v => v > 0)
      const avg3 = recent.length > 0 ? recent.reduce((a, b) => a + b, 0) / recent.length : 0
      const avg6 = all.length > 0 ? all.reduce((a, b) => a + b, 0) / all.length : 0
      const drifting = avg6 > 0 && avg3 > avg6 * 1.1

      return {
        categoryId,
        name: meta.name,
        color: meta.color,
        values,
        avg3: Math.round(avg3 * 100) / 100,
        avg6: Math.round(avg6 * 100) / 100,
        drifting,
      }
    })

    // Sort by total spend descending
    series.sort((a, b) => b.values.reduce((s, v) => s + v, 0) - a.values.reduce((s, v) => s + v, 0))

    res.json({ months, series })
  } catch (err) {
    next(err)
  }
})

export default router
