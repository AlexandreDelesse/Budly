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

// GET /api/analytics/simulator?categoryId=x&targetAmount=80
router.get('/simulator', async (req, res, next) => {
  try {
    const categoryId = req.query.categoryId as string
    const targetAmount = parseFloat(req.query.targetAmount as string)

    if (!categoryId) {
      res.status(400).json({ error: 'categoryId is required' })
      return
    }

    const category = await db.category.findUnique({
      where: { id: categoryId },
      select: { name: true, color: true },
    })
    if (!category) {
      res.status(404).json({ error: 'Category not found' })
      return
    }

    // Last 6 months of transactions for this category
    const now = new Date()
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - 5, 1)

    const txs = await db.transaction.findMany({
      where: {
        categoryId,
        amount: { lt: 0 },
        date: { gte: rangeStart },
      },
      select: { amount: true, date: true },
    })

    // Build per-month totals
    const monthMap = new Map<string, number>()
    for (const tx of txs) {
      const d = tx.date
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthMap.set(key, (monthMap.get(key) ?? 0) + Math.abs(Number(tx.amount)))
    }

    // Ordered history (last 6 months, oldest → newest)
    const history: { month: string; actual: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (monthMap.has(key)) {
        history.push({ month: key, actual: Math.round((monthMap.get(key) ?? 0) * 100) / 100 })
      }
    }

    const monthsWithData = history.filter(h => h.actual > 0)
    const currentMonthlyAvg =
      monthsWithData.length > 0
        ? Math.round((monthsWithData.reduce((s, h) => s + h.actual, 0) / monthsWithData.length) * 100) / 100
        : 0

    const target = isNaN(targetAmount) ? currentMonthlyAvg : Math.max(0, targetAmount)
    const monthlySaving = Math.max(0, Math.round((currentMonthlyAvg - target) * 100) / 100)
    const yearlySaving = Math.round(monthlySaving * 12 * 100) / 100

    res.json({
      categoryId,
      categoryName: category.name,
      categoryColor: category.color,
      currentMonthlyAvg,
      targetAmount: target,
      monthlySaving,
      yearlySaving,
      history,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/analytics/projection?fromDate=2024-03-26
router.get('/projection', async (req, res, next) => {
  try {
    const fromDateParam = req.query.fromDate as string | undefined
    const fromDate = fromDateParam ? new Date(fromDateParam) : new Date()
    fromDate.setHours(0, 0, 0, 0)

    // Project 30 days forward
    const toDate = new Date(fromDate)
    toDate.setDate(toDate.getDate() + 30)

    // Current balance: sum of all transactions up to (not including) fromDate
    const balanceAgg = await db.transaction.aggregate({
      where: { date: { lt: fromDate } },
      _sum: { amount: true },
    })
    const currentBalance = Number(balanceAgg._sum.amount ?? 0)

    // ── Variable recurring: daily average from last 90 days ──────────────────
    const varStart = new Date(fromDate)
    varStart.setDate(varStart.getDate() - 90)

    const varAgg = await db.transaction.aggregate({
      where: {
        expenseType: 'VARIABLE_RECURRING',
        amount: { lt: 0 },
        date: { gte: varStart, lt: fromDate },
      },
      _sum: { amount: true },
    })
    const dailyVariableAvg = Math.abs(Number(varAgg._sum.amount ?? 0)) / 90

    // ── Fixed recurring: detect expected dates in the projection window ───────
    const fixedTxs = await db.transaction.findMany({
      where: {
        expenseType: 'FIXED_RECURRING',
        amount: { lt: 0 },
        date: {
          gte: new Date(fromDate.getFullYear(), fromDate.getMonth() - 3, 1),
          lt: fromDate,
        },
      },
      select: { merchantId: true, amount: true, date: true },
      orderBy: { date: 'desc' },
    })

    // Group by merchant → compute most common day-of-month and typical amount
    const merchantMap = new Map<
      string,
      { days: number[]; amounts: number[] }
    >()
    for (const tx of fixedTxs) {
      if (!tx.merchantId) continue
      if (!merchantMap.has(tx.merchantId)) merchantMap.set(tx.merchantId, { days: [], amounts: [] })
      const entry = merchantMap.get(tx.merchantId)!
      entry.days.push(tx.date.getDate())
      entry.amounts.push(Math.abs(Number(tx.amount)))
    }

    // For each fixed merchant, compute modal day and median amount
    const scheduledFixed: { merchantId: string; amount: number; expectedDate: string }[] = []
    for (const [merchantId, { days, amounts }] of merchantMap) {
      // Modal day
      const dayFreq = new Map<number, number>()
      for (const d of days) dayFreq.set(d, (dayFreq.get(d) ?? 0) + 1)
      const modalDay = [...dayFreq.entries()].sort((a, b) => b[1] - a[1])[0][0]

      // Median amount
      const sorted = [...amounts].sort((a, b) => a - b)
      const medianAmount = sorted[Math.floor(sorted.length / 2)]

      // Schedule: check if this day still falls within our 30-day window
      // and hasn't occurred yet in the current month
      for (let monthOffset = 0; monthOffset <= 1; monthOffset++) {
        const candidate = new Date(fromDate.getFullYear(), fromDate.getMonth() + monthOffset, modalDay)
        if (candidate >= fromDate && candidate < toDate) {
          scheduledFixed.push({
            merchantId,
            amount: medianAmount,
            expectedDate: candidate.toISOString().split('T')[0],
          })
          break
        }
      }
    }

    // Load merchant names
    const merchantIds = [...new Set(scheduledFixed.map(s => s.merchantId))]
    const merchants = merchantIds.length > 0
      ? await db.merchant.findMany({
          where: { id: { in: merchantIds } },
          select: { id: true, name: true, displayName: true },
        })
      : []
    const merchantNameMap = new Map(merchants.map(m => [m.id, m.displayName ?? m.name]))

    // ── Build day-by-day projection ───────────────────────────────────────────
    const fixedByDate = new Map<string, number>()
    for (const s of scheduledFixed) {
      fixedByDate.set(s.expectedDate, (fixedByDate.get(s.expectedDate) ?? 0) + s.amount)
    }

    const days: { date: string; balance: number }[] = []
    let runningBalance = currentBalance

    for (let i = 0; i < 30; i++) {
      const d = new Date(fromDate)
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]

      // Subtract daily variable average
      runningBalance -= dailyVariableAvg
      // Subtract any scheduled fixed payment on this day
      if (fixedByDate.has(dateStr)) {
        runningBalance -= fixedByDate.get(dateStr)!
      }

      days.push({ date: dateStr, balance: Math.round(runningBalance * 100) / 100 })
    }

    // End of current month balance
    const eomDay = new Date(fromDate.getFullYear(), fromDate.getMonth() + 1, 0) // last day of month
    const eomDaysFromNow = Math.min(
      Math.floor((eomDay.getTime() - fromDate.getTime()) / 86400000),
      29
    )
    const endOfMonthBalance = days[eomDaysFromNow]?.balance ?? days[days.length - 1].balance

    res.json({
      currentBalance: Math.round(currentBalance * 100) / 100,
      days,
      endOfMonthBalance,
      scheduledFixed: scheduledFixed.map(s => ({
        merchantName: merchantNameMap.get(s.merchantId) ?? s.merchantId,
        amount: -s.amount,
        expectedDate: s.expectedDate,
      })),
    })
  } catch (err) {
    next(err)
  }
})

export default router
