import client from './client'
import type { Category } from './categories'

export interface BudgetEntry {
  id: string | null
  categoryId: string
  monthYear: string
  cap: number | null
  category: Category
  spent: number
  percentOfBudget: number | null
}

export interface BudgetsOverview {
  month: string
  budgeted: BudgetEntry[]
  unbudgeted: BudgetEntry[]
}

export async function fetchBudgets(month: string): Promise<BudgetsOverview> {
  const { data } = await client.get<BudgetsOverview>('/budgets', { params: { month } })
  return data
}

export async function createBudget(body: {
  categoryId: string
  monthYear: string
  cap: number
}): Promise<BudgetEntry> {
  const { data } = await client.post<BudgetEntry>('/budgets', body)
  return data
}

export async function updateBudget(id: string, cap: number): Promise<BudgetEntry> {
  const { data } = await client.put<BudgetEntry>(`/budgets/${id}`, { cap })
  return data
}

export async function deleteBudget(id: string): Promise<void> {
  await client.delete(`/budgets/${id}`)
}
