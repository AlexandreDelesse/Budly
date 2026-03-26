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

export interface SimulatorData {
  categoryId: string
  categoryName: string
  categoryColor: string
  currentMonthlyAvg: number
  targetAmount: number
  monthlySaving: number
  yearlySaving: number
  history: { month: string; actual: number }[]
}

export async function fetchSimulator(categoryId: string, targetAmount: number): Promise<SimulatorData> {
  const { data } = await client.get<SimulatorData>('/analytics/simulator', {
    params: { categoryId, targetAmount },
  })
  return data
}

export interface ProjectionDay {
  date: string
  balance: number
}

export interface ScheduledFixed {
  merchantName: string
  amount: number
  expectedDate: string
}

export interface ProjectionData {
  currentBalance: number
  days: ProjectionDay[]
  endOfMonthBalance: number
  scheduledFixed: ScheduledFixed[]
}

export async function fetchProjection(fromDate: string): Promise<ProjectionData> {
  const { data } = await client.get<ProjectionData>('/analytics/projection', {
    params: { fromDate },
  })
  return data
}
