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
