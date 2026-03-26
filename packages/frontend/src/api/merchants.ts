import client from './client'
import type { Category } from './categories'

export interface MerchantGroup {
  merchantId: string
  merchantName: string
  transactionCount: number
  totalAmount: string
  sampleLabels: string[]
  categoryId: string | null
  expenseType: ExpenseType
}

export type ExpenseType = 'FIXED_RECURRING' | 'VARIABLE_RECURRING' | 'ONE_TIME' | 'UNKNOWN'

export interface Merchant {
  id: string
  name: string
  displayName: string | null
  categoryId: string | null
  expenseType: ExpenseType
  category: Category | null
}

export async function fetchUncategorizedGrouped(): Promise<MerchantGroup[]> {
  const { data } = await client.get<MerchantGroup[]>('/transactions/uncategorized/grouped')
  return data
}

export async function patchMerchant(
  id: string,
  body: { categoryId?: string | null; expenseType?: ExpenseType; displayName?: string | null }
): Promise<Merchant> {
  const { data } = await client.patch<Merchant>(`/merchants/${id}`, body)
  return data
}
