import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // Zod validation errors → 400 with field details
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Données invalides',
      details: err.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
    })
    return
  }

  // Prisma unique constraint → 409
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Cette entrée existe déjà' })
      return
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Ressource introuvable' })
      return
    }
    console.error(`Prisma error ${err.code}:`, err.message)
    res.status(500).json({ error: 'Erreur base de données' })
    return
  }

  // Multer file filter error → 400
  if (err instanceof Error && err.message === 'Only CSV files are accepted') {
    res.status(400).json({ error: err.message })
    return
  }

  // Generic errors
  console.error(err)
  const message = err instanceof Error ? err.message : 'Erreur interne'
  res.status(500).json({ error: message })
}
