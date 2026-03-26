import { Router } from 'express'
import multer from 'multer'
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

export default router
