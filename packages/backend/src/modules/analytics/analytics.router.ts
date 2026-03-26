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

export default router
