import { Prisma } from '@prisma/client'
import db from '../../db'
import { parseCsvBuffer } from './csv.parser'

export async function importTransactions(filename: string, buffer: Buffer) {
  const rows = parseCsvBuffer(buffer)

  if (rows.length === 0) {
    throw new Error('No valid rows found in CSV file')
  }

  let importedCount = 0
  let skippedCount = 0

  // Upsert all merchants first (bulk-friendly: one query per unique name)
  const uniqueMerchantNames = [...new Set(rows.map(r => r.merchantName))]
  await Promise.all(
    uniqueMerchantNames.map(name =>
      db.merchant.upsert({
        where: { name },
        update: {},
        create: { name },
      })
    )
  )

  // Load merchant map: name → id
  const merchants = await db.merchant.findMany({
    where: { name: { in: uniqueMerchantNames } },
    select: { id: true, name: true, categoryId: true },
  })
  const merchantMap = new Map(merchants.map(m => [m.name, m]))

  // Create import batch
  const batch = await db.importBatch.create({
    data: {
      filename,
      rowCount: rows.length,
      importedCount: 0,
      skippedCount: 0,
    },
  })

  // Insert transactions one by one to track dedup accurately
  for (const row of rows) {
    const merchant = merchantMap.get(row.merchantName)

    try {
      await db.transaction.create({
        data: {
          date: row.date,
          label: row.label,
          amount: new Prisma.Decimal(row.amount),
          fingerprint: row.fingerprint,
          merchantId: merchant?.id,
          // Inherit category from merchant rule if already set
          categoryId: merchant?.categoryId ?? null,
          importBatchId: batch.id,
        },
      })
      importedCount++
    } catch (err: unknown) {
      // P2002 = unique constraint violation → fingerprint duplicate
      if (isPrismaUniqueError(err)) {
        skippedCount++
      } else {
        throw err
      }
    }
  }

  // Update batch with final counts
  await db.importBatch.update({
    where: { id: batch.id },
    data: { importedCount, skippedCount },
  })

  return { imported: importedCount, skipped: skippedCount, batchId: batch.id }
}

function isPrismaUniqueError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  )
}
