import { Router } from 'express'
import multer from 'multer'
import { Prisma } from '@prisma/client'
import db from '../../db'
import { importTransactions } from './import.service'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true)
    } else {
      cb(new Error('Only CSV files are accepted'))
    }
  },
})

// POST /api/import
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' })
      return
    }
    const result = await importTransactions(req.file.originalname, req.file.buffer)
    res.json(result)
  } catch (err) {
    next(err)
  }
})

// GET /api/import/batches
router.get('/batches', async (_req, res, next) => {
  try {
    const batches = await db.importBatch.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { duplicates: { where: { status: 'PENDING' } } } },
      },
    })
    res.json(batches)
  } catch (err) {
    next(err)
  }
})

// GET /api/import/batches/:id
router.get('/batches/:id', async (req, res, next) => {
  try {
    const batch = await db.importBatch.findUnique({
      where: { id: req.params.id },
      include: {
        transactions: {
          orderBy: { date: 'desc' },
          take: 50,
          select: { id: true, date: true, label: true, amount: true, merchantId: true, categoryId: true },
        },
      },
    })
    if (!batch) {
      res.status(404).json({ error: 'Batch not found' })
      return
    }
    res.json(batch)
  } catch (err) {
    next(err)
  }
})

// GET /api/import/duplicates?batchId=
router.get('/duplicates', async (req, res, next) => {
  try {
    const { batchId } = req.query as { batchId?: string }
    const duplicates = await db.duplicateCandidate.findMany({
      where: {
        status: 'PENDING',
        ...(batchId ? { importBatchId: batchId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { importBatch: { select: { filename: true } } },
    })
    res.json(duplicates)
  } catch (err) {
    next(err)
  }
})

// POST /api/import/duplicates/:id/keep — force-insert as new transaction
router.post('/duplicates/:id/keep', async (req, res, next) => {
  try {
    const duplicate = await db.duplicateCandidate.findUnique({ where: { id: req.params.id } })
    if (!duplicate) {
      res.status(404).json({ error: 'Duplicate candidate not found' })
      return
    }

    // Force-insert with modified fingerprint to bypass unique constraint
    const newFingerprint = `${duplicate.fingerprint}-kept-${Date.now()}`

    await db.transaction.create({
      data: {
        date: duplicate.date,
        label: duplicate.label,
        amount: new Prisma.Decimal(duplicate.amount.toString()),
        fingerprint: newFingerprint,
        importBatchId: duplicate.importBatchId,
        isManual: true,
      },
    })

    await db.duplicateCandidate.update({
      where: { id: req.params.id },
      data: { status: 'KEPT' },
    })

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// POST /api/import/duplicates/:id/ignore
router.post('/duplicates/:id/ignore', async (req, res, next) => {
  try {
    const duplicate = await db.duplicateCandidate.update({
      where: { id: req.params.id },
      data: { status: 'IGNORED' },
    })
    res.json(duplicate)
  } catch (err) {
    next(err)
  }
})

export default router
