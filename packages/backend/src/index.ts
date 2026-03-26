import express from 'express'
import cors from 'cors'
import { errorHandler } from './middleware/errorHandler'
import importRouter from './modules/import/import.router'
import categoriesRouter from './modules/categories/categories.router'
import merchantsRouter from './modules/merchants/merchants.router'
import transactionsRouter from './modules/transactions/transactions.router'

const app = express()
const PORT = process.env.PORT ?? 3001

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/import', importRouter)
app.use('/api/categories', categoriesRouter)
app.use('/api/merchants', merchantsRouter)
app.use('/api/transactions', transactionsRouter)

app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})
