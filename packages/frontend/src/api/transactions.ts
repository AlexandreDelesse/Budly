import client from './client'
import type { Category } from './categories'
import type { ExpenseType } from './merchants'

export interface Transaction {
  id: string
  date: string
  label: string
  amount: string
  currency: string
  merchantId: string | null
  categoryId: string | null
  expenseType: ExpenseType
  isManual: boolean
  merchant: { id: string; name: string; displayName: string | null } | null
  category: Category | null
}

export interface TransactionsPage {
  transactions: Transaction[]
  total: number
  page: number
  limit: number
}

export async function fetchTransactions(params: {
  month?: string
  categoryId?: string
  uncategorized?: boolean
  page?: number
  limit?: number
}): Promise<TransactionsPage> {
  const { data } = await client.get<TransactionsPage>('/transactions', { params })
  return data
}

export async function patchTransaction(
  id: string,
  body: { categoryId?: string | null; expenseType?: ExpenseType }
): Promise<Transaction> {
  const { data } = await client.patch<Transaction>(`/transactions/${id}`, body)
  return data
}
