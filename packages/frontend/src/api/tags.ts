import client from './client'

export interface Tag {
  id: string
  name: string
  color: string
  createdAt: string
  updatedAt: string
}

export async function fetchTags(): Promise<Tag[]> {
  const { data } = await client.get<Tag[]>('/tags')
  return data
}

export async function createTag(body: { name: string; color?: string }): Promise<Tag> {
  const { data } = await client.post<Tag>('/tags', body)
  return data
}

export async function deleteTag(id: string): Promise<void> {
  await client.delete(`/tags/${id}`)
}
