import client from './client'

export interface ImportResult {
  imported: number
  skipped: number
  batchId: string
}

export interface ImportBatch {
  id: string
  filename: string
  rowCount: number
  importedCount: number
  skippedCount: number
  createdAt: string
  _count?: { duplicates: number }
}

export interface DuplicateCandidate {
  id: string
  fingerprint: string
  date: string
  label: string
  amount: string
  importBatchId: string
  status: 'PENDING' | 'KEPT' | 'IGNORED'
  createdAt: string
  importBatch: { filename: string }
}

export async function uploadCsv(
  file: File,
  onProgress?: (pct: number) => void
): Promise<ImportResult> {
  const formData = new FormData()
  formData.append('file', file)

  const { data } = await client.post<ImportResult>('/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: e => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total))
      }
    },
  })
  return data
}

export async function fetchBatches(): Promise<ImportBatch[]> {
  const { data } = await client.get<ImportBatch[]>('/import/batches')
  return data
}

export async function fetchDuplicates(batchId?: string): Promise<DuplicateCandidate[]> {
  const { data } = await client.get<DuplicateCandidate[]>('/import/duplicates', {
    params: batchId ? { batchId } : {},
  })
  return data
}

export async function keepDuplicate(id: string): Promise<void> {
  await client.post(`/import/duplicates/${id}/keep`)
}

export async function ignoreDuplicate(id: string): Promise<void> {
  await client.post(`/import/duplicates/${id}/ignore`)
}
