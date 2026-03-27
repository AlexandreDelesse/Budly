import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import LinearProgress from '@mui/material/LinearProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import {
  fetchBatches,
  fetchDuplicates,
  keepDuplicate,
  ignoreDuplicate,
  uploadCsv,
  type ImportResult,
  type DuplicateCandidate,
} from '../../api/import'

// ─── Duplicates Dialog ────────────────────────────────────────────────────

function formatAmount(amount: string | number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(amount))
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface DuplicatesDialogProps {
  open: boolean
  onClose: () => void
  batchId?: string
}

function DuplicatesDialog({ open, onClose, batchId }: DuplicatesDialogProps) {
  const queryClient = useQueryClient()
  const { enqueueSnackbar } = useSnackbar()

  const { data: duplicates = [], isLoading } = useQuery({
    queryKey: ['duplicates', batchId],
    queryFn: () => fetchDuplicates(batchId),
    enabled: open,
  })

  const pending = duplicates.filter(d => d.status === 'PENDING')

  const { mutate: keep, isPending: keeping } = useMutation({
    mutationFn: (id: string) => keepDuplicate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['duplicates'] })
      queryClient.invalidateQueries({ queryKey: ['import-batches'] })
      enqueueSnackbar('Transaction conservée', { variant: 'success' })
    },
    onError: () => enqueueSnackbar('Erreur', { variant: 'error' }),
  })

  const { mutate: ignore, isPending: ignoring } = useMutation({
    mutationFn: (id: string) => ignoreDuplicate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['duplicates'] })
      queryClient.invalidateQueries({ queryKey: ['import-batches'] })
      enqueueSnackbar('Doublon ignoré', { variant: 'success' })
    },
    onError: () => enqueueSnackbar('Erreur', { variant: 'error' }),
  })

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Doublons à valider
        {pending.length > 0 && (
          <Chip label={`${pending.length} en attente`} color="warning" size="small" sx={{ ml: 1 }} />
        )}
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        {isLoading ? (
          <Box sx={{ p: 3 }}><LinearProgress /></Box>
        ) : pending.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CheckCircleOutlineIcon color="success" sx={{ fontSize: 48, mb: 1 }} />
            <Typography>Aucun doublon en attente de validation.</Typography>
          </Box>
        ) : (
          <>
            <Alert severity="info" sx={{ m: 2, mb: 0 }}>
              Ces transactions ont le même fingerprint qu'une transaction déjà importée.
              Choisissez de les conserver (nouvelle entrée) ou de les ignorer.
            </Alert>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Libellé</TableCell>
                    <TableCell align="right">Montant</TableCell>
                    <TableCell>Fichier source</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pending.map((d: DuplicateCandidate) => (
                    <TableRow key={d.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(d.date)}</TableCell>
                      <TableCell sx={{ maxWidth: 240 }}>
                        <Tooltip title={d.label}>
                          <Typography variant="body2" noWrap>{d.label}</Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap', color: Number(d.amount) < 0 ? 'error.main' : 'success.main', fontWeight: 'medium' }}>
                        {formatAmount(d.amount)}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                        {d.importBatch.filename}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        <Button
                          size="small"
                          color="success"
                          variant="outlined"
                          disabled={keeping || ignoring}
                          onClick={() => keep(d.id)}
                          sx={{ mr: 1 }}
                        >
                          Conserver
                        </Button>
                        <Button
                          size="small"
                          color="inherit"
                          variant="outlined"
                          disabled={keeping || ignoring}
                          onClick={() => ignore(d.id)}
                        >
                          Ignorer
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fermer</Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function ImportPage() {
  const { enqueueSnackbar } = useSnackbar()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [duplicatesOpen, setDuplicatesOpen] = useState(false)
  const [selectedBatchId, setSelectedBatchId] = useState<string | undefined>()

  const { data: batches = [] } = useQuery({
    queryKey: ['import-batches'],
    queryFn: fetchBatches,
  })

  const totalPendingDuplicates = batches.reduce((sum, b) => sum + (b._count?.duplicates ?? 0), 0)

  async function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      enqueueSnackbar('Seuls les fichiers CSV sont acceptés', { variant: 'error' })
      return
    }

    setUploading(true)
    setProgress(0)
    setResult(null)

    try {
      const res = await uploadCsv(file, setProgress)
      setResult(res)
      queryClient.invalidateQueries({ queryKey: ['import-batches'] })
      queryClient.invalidateQueries({ queryKey: ['duplicates'] })
      enqueueSnackbar(`${res.imported} transaction(s) importée(s)`, { variant: 'success' })
    } catch {
      enqueueSnackbar("Erreur lors de l'import", { variant: 'error' })
    } finally {
      setUploading(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  function openDuplicates(batchId?: string) {
    setSelectedBatchId(batchId)
    setDuplicatesOpen(true)
  }

  return (
    <Box sx={{ maxWidth: 800 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">
          Importer un relevé
        </Typography>
        {totalPendingDuplicates > 0 && (
          <Button
            variant="outlined"
            color="warning"
            size="small"
            startIcon={<WarningAmberIcon />}
            onClick={() => openDuplicates()}
          >
            {totalPendingDuplicates} doublon(s) à valider
          </Button>
        )}
      </Box>

      {/* Drop zone */}
      <Paper
        variant="outlined"
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        sx={{
          p: 6,
          mb: 3,
          textAlign: 'center',
          cursor: uploading ? 'default' : 'pointer',
          borderStyle: 'dashed',
          borderWidth: 2,
          borderColor: dragging ? 'primary.main' : 'divider',
          bgcolor: dragging ? 'action.hover' : 'background.paper',
          transition: 'border-color 0.2s, background-color 0.2s',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          hidden
          onChange={onInputChange}
        />
        <UploadFileIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
        <Typography variant="body1" color="text.secondary">
          Glisser-déposer votre fichier CSV ici, ou{' '}
          <Typography component="span" color="primary" sx={{ textDecoration: 'underline' }}>
            cliquer pour parcourir
          </Typography>
        </Typography>
        <Typography variant="caption" color="text.disabled" display="block" mt={0.5}>
          BNP Paribas, Société Générale, Crédit Agricole, LCL — max 10 Mo
        </Typography>
      </Paper>

      {/* Upload progress */}
      {uploading && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Import en cours…
          </Typography>
          <LinearProgress variant="determinate" value={progress} />
        </Box>
      )}

      {/* Result summary */}
      {result && !uploading && (
        <Paper
          variant="outlined"
          sx={{ p: 3, mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}
        >
          <CheckCircleOutlineIcon color="success" sx={{ fontSize: 36 }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography fontWeight="medium">
              {result.imported} transaction(s) importée(s)
              {result.skipped > 0 && `, ${result.skipped} doublon(s)`}
            </Typography>
          </Box>
          {result.skipped > 0 && (
            <Button
              variant="outlined"
              color="warning"
              size="small"
              startIcon={<WarningAmberIcon />}
              onClick={() => openDuplicates(result.batchId)}
            >
              Valider les doublons
            </Button>
          )}
          {result.imported > 0 && (
            <Button variant="contained" onClick={() => navigate('/categorize')}>
              Catégoriser
            </Button>
          )}
        </Paper>
      )}

      {/* Batch history */}
      {batches.length > 0 && (
        <>
          <Typography variant="h6" gutterBottom>
            Historique des imports
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fichier</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Lignes</TableCell>
                  <TableCell align="right">Importées</TableCell>
                  <TableCell align="right">Doublons</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {batches.map(b => {
                  const pendingCount = b._count?.duplicates ?? 0
                  return (
                    <TableRow key={b.id} hover>
                      <TableCell>{b.filename}</TableCell>
                      <TableCell>
                        {new Date(b.createdAt).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell align="right">{b.rowCount}</TableCell>
                      <TableCell align="right">
                        <Chip label={b.importedCount} size="small" color="success" variant="outlined" />
                      </TableCell>
                      <TableCell align="right">
                        {b.skippedCount > 0 ? (
                          <Chip
                            label={b.skippedCount}
                            size="small"
                            color={pendingCount > 0 ? 'warning' : 'default'}
                            variant="outlined"
                            onClick={pendingCount > 0 ? () => openDuplicates(b.id) : undefined}
                            sx={{ cursor: pendingCount > 0 ? 'pointer' : 'default' }}
                          />
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      <DuplicatesDialog
        open={duplicatesOpen}
        onClose={() => setDuplicatesOpen(false)}
        batchId={selectedBatchId}
      />
    </Box>
  )
}
