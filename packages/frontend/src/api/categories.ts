import client from './client'

export interface Category {
  id: string
  name: string
  color: string
  icon: string
}

export async function fetchCategories(): Promise<Category[]> {
  const { data } = await client.get<Category[]>('/categories')
  return data
}

export async function createCategory(body: Omit<Category, 'id'>): Promise<Category> {
  const { data } = await client.post<Category>('/categories', body)
  return data
}

export async function updateCategory(id: string, body: Omit<Category, 'id'>): Promise<Category> {
  const { data } = await client.put<Category>(`/categories/${id}`, body)
  return data
}

export async function deleteCategory(id: string): Promise<void> {
  await client.delete(`/categories/${id}`)
}
