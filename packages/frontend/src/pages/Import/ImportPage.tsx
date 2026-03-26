import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
import UploadFileIcon from '@mui/icons-material/UploadFile'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { fetchBatches, uploadCsv, type ImportResult } from '../../api/import'

export default function ImportPage() {
  const { enqueueSnackbar } = useSnackbar()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)

  const { data: batches = [] } = useQuery({
    queryKey: ['import-batches'],
    queryFn: fetchBatches,
  })

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

  return (
    <Box sx={{ maxWidth: 800 }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        Importer un relevé
      </Typography>

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
              {result.skipped > 0 && `, ${result.skipped} ignorée(s) (doublons)`}
            </Typography>
          </Box>
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
                {batches.map(b => (
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
                      <Chip
                        label={b.importedCount}
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      {b.skippedCount > 0 ? (
                        <Chip label={b.skippedCount} size="small" color="default" variant="outlined" />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  )
}
