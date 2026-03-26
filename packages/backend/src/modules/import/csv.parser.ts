import { createHash } from 'crypto'
import { parse } from 'csv-parse/sync'

// ─── Bank format definitions ──────────────────────────────────────────────────

interface BankFormat {
  name: string
  delimiter: string
  dateCol: string
  labelCol: string
  amountCol?: string   // single signed amount column
  debitCol?: string    // positive = expense
  creditCol?: string   // positive = income
  dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'DD/MM/YY'
}

const BANK_FORMATS: BankFormat[] = [
  {
    name: 'BNP Paribas',
    delimiter: ';',
    dateCol: 'Date',
    labelCol: 'Libellé',
    amountCol: 'Montant',
    dateFormat: 'DD/MM/YYYY',
  },
  {
    name: 'Société Générale',
    delimiter: ';',
    dateCol: 'Date de comptabilisation',
    labelCol: 'Libellé',
    debitCol: 'Débit',
    creditCol: 'Crédit',
    dateFormat: 'DD/MM/YYYY',
  },
  {
    name: 'Crédit Agricole',
    delimiter: ';',
    dateCol: 'Date',
    labelCol: 'Libellé',
    debitCol: 'Débit euros',
    creditCol: 'Crédit euros',
    dateFormat: 'DD/MM/YYYY',
  },
  {
    name: 'LCL',
    delimiter: ';',
    dateCol: 'Date',
    labelCol: 'Libellé',
    debitCol: 'Débit',
    creditCol: 'Crédit',
    dateFormat: 'DD/MM/YYYY',
  },
  {
    name: 'BoursoBank',
    delimiter: ';',
    dateCol: 'dateOp',
    labelCol: 'label',
    amountCol: 'amount',
    dateFormat: 'YYYY-MM-DD',
  },
  {
    name: 'Generic CSV',
    delimiter: ',',
    dateCol: 'date',
    labelCol: 'label',
    amountCol: 'amount',
    dateFormat: 'YYYY-MM-DD',
  },
]

// ─── Format detection ─────────────────────────────────────────────────────────

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function detectFormat(headers: string[]): BankFormat {
  const normalizedHeaders = headers.map(normalize)

  for (const fmt of BANK_FORMATS) {
    const required = [fmt.dateCol, fmt.labelCol, fmt.amountCol ?? fmt.debitCol ?? ''].filter(Boolean)
    const allPresent = required.every(col => normalizedHeaders.includes(normalize(col)))
    if (allPresent) return fmt
  }

  // Fallback: return generic
  return BANK_FORMATS[BANK_FORMATS.length - 1]
}

// ─── Amount parsing ───────────────────────────────────────────────────────────

// Handles French number formats: "1 234,56" "-1.234,56" "1234.56"
function parseAmount(raw: string): number {
  if (!raw || raw.trim() === '') return 0
  // Remove spaces and non-breaking spaces (thousands separator in French)
  let cleaned = raw.replace(/[\s\u00A0]/g, '')
  // If both . and , exist, the one appearing last is the decimal separator
  const dotIdx = cleaned.lastIndexOf('.')
  const commaIdx = cleaned.lastIndexOf(',')
  if (commaIdx > dotIdx) {
    // French format: 1.234,56
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  } else {
    // English or already dot-decimal: 1,234.56
    cleaned = cleaned.replace(/,/g, '')
  }
  const val = parseFloat(cleaned)
  return isNaN(val) ? 0 : val
}

// ─── Date parsing ─────────────────────────────────────────────────────────────

function parseDate(raw: string, format: BankFormat['dateFormat']): Date {
  const s = raw.trim()
  if (format === 'DD/MM/YYYY') {
    const [d, m, y] = s.split('/')
    return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`)
  }
  if (format === 'DD/MM/YY') {
    const [d, m, y] = s.split('/')
    return new Date(`20${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`)
  }
  return new Date(s)
}

// ─── Merchant normalization ───────────────────────────────────────────────────

const NOISE_PREFIXES = [
  /^CARTE\s+\d+\s*/i,
  /^CB\s+/i,
  /^VIR\s+(SEPA\s+)?/i,
  /^VIREMENT\s+(SEPA\s+)?/i,
  /^PRLV\s+(SEPA\s+)?/i,
  /^PRELEVEMENT\s+(SEPA\s+)?/i,
  /^RETRAIT\s+DAB\s+/i,
  /^RET\.?\s+DAB\s+/i,
  /^FACTURE\s+/i,
]

const NOISE_SUFFIXES = [
  /\s+\d{2}\/\d{2}.*$/, // date at end
  /\s+REF\s*:?\s*\S+$/i,
  /\s+N°\s*\S+$/i,
]

export function normalizeMerchant(label: string): string {
  let s = label.toUpperCase().trim()

  // Remove card/account numbers (6+ consecutive digits)
  s = s.replace(/\b\d{6,}\b/g, '').trim()

  // Strip known noise prefixes
  for (const re of NOISE_PREFIXES) {
    s = s.replace(re, '').trim()
  }

  // Strip noise suffixes
  for (const re of NOISE_SUFFIXES) {
    s = s.replace(re, '').trim()
  }

  // Collapse multiple spaces
  s = s.replace(/\s+/g, ' ').trim()

  // Take first 40 chars to keep it manageable
  return s.slice(0, 40) || label.toUpperCase().slice(0, 40)
}

// ─── Fingerprint ──────────────────────────────────────────────────────────────

export function generateFingerprint(date: Date, amount: number, label: string): string {
  const payload = `${date.toISOString().split('T')[0]}|${amount.toFixed(2)}|${label.trim().toLowerCase()}`
  return createHash('sha256').update(payload).digest('hex')
}

// ─── Parsed row ───────────────────────────────────────────────────────────────

export interface ParsedRow {
  date: Date
  label: string
  amount: number      // negative = expense, positive = income
  merchantName: string
  fingerprint: string
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseCsvBuffer(buffer: Buffer): ParsedRow[] {
  // Try to detect delimiter before full parse
  const sample = buffer.toString('utf8').split('\n')[0]
  const delimiter = sample.includes(';') ? ';' : ','

  const records = parse(buffer, {
    delimiter,
    columns: true,
    skip_empty_lines: true,
    bom: true,             // handle UTF-8 BOM from French bank exports
    relax_column_count: true,
    trim: true,
  }) as Record<string, string>[]

  if (records.length === 0) return []

  const headers = Object.keys(records[0])
  const fmt = detectFormat(headers)

  const rows: ParsedRow[] = []

  for (const record of records) {
    const rawDate = record[fmt.dateCol] ?? ''
    const rawLabel = record[fmt.labelCol] ?? ''

    let amount: number
    if (fmt.amountCol) {
      amount = parseAmount(record[fmt.amountCol] ?? '')
    } else {
      const debit = parseAmount(record[fmt.debitCol!] ?? '')
      const credit = parseAmount(record[fmt.creditCol!] ?? '')
      // debit column = money out → negative; credit = money in → positive
      amount = credit > 0 ? credit : -Math.abs(debit)
    }

    if (!rawDate || !rawLabel) continue

    const date = parseDate(rawDate, fmt.dateFormat)
    if (isNaN(date.getTime())) continue

    const label = rawLabel.trim()
    const merchantName = normalizeMerchant(label)
    const fingerprint = generateFingerprint(date, amount, label)

    rows.push({ date, label, amount, merchantName, fingerprint })
  }

  return rows
}
