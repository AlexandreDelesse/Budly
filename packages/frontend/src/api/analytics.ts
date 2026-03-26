import client from './client'

export interface CategoryBreakdown {
  categoryId: string
  name: string
  color: string
  icon: string
  amount: number
  budget: number | null
  percentOfBudget: number | null
}

export interface DashboardData {
  month: string
  balance: number
  totalExpenses: number
  totalIncome: number
  uncategorizedAmount: number
  byCategory: CategoryBreakdown[]
  prevMonth: {
    totalExpenses: number
    delta: number | null
  }
}

export async function fetchDashboard(month: string): Promise<DashboardData> {
  const { data } = await client.get<DashboardData>('/analytics/dashboard', { params: { month } })
  return data
}

export interface TrendSeries {
  categoryId: string
  name: string
  color: string
  values: number[]
  avg3: number
  avg6: number
  drifting: boolean
}

export interface TrendsData {
  months: string[]
  series: TrendSeries[]
}

export async function fetchTrends(months: number, categoryIds?: string[]): Promise<TrendsData> {
  const { data } = await client.get<TrendsData>('/analytics/trends', {
    params: {
      months,
      ...(categoryIds && categoryIds.length > 0 && { categoryIds: categoryIds.join(',') }),
    },
  })
  return data
}
