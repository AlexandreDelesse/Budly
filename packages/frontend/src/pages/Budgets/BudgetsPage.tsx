import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import LinearProgress from '@mui/material/LinearProgress'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Skeleton from '@mui/material/Skeleton'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import { fetchBudgets, createBudget, updateBudget, deleteBudget, type BudgetEntry } from '../../api/budgets'
import { useMonthSelector } from '../../hooks/useMonthSelector'

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)

function budgetColor(pct: number): 'success' | 'warning' | 'error' {
  if (pct >= 100) return 'error'
  if (pct >= 80) return 'warning'
  return 'success'
}

// ─── Edit / Create dialog ─────────────────────────────────────────────────────

interface BudgetDialogProps {
  entry: BudgetEntry | null // null = closed
  onClose: () => void
}

function BudgetDialog({ entry, onClose }: BudgetDialogProps) {
  const { enqueueSnackbar } = useSnackbar()
  const queryClient = useQueryClient()
  const [cap, setCap] = useState<string>(entry?.cap != null ? String(entry.cap) : '')

  // Keep cap in sync when entry changes (re-open)
  const capValue = parseFloat(cap)
  const isValid = !isNaN(capValue) && capValue > 0

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      if (entry?.id) return updateBudget(entry.id, capValue)
      return createBudget({ categoryId: entry!.categoryId, monthYear: entry!.monthYear, cap: capValue })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      enqueueSnackbar('Budget enregistré', { variant: 'success' })
      onClose()
    },
    onError: () => enqueueSnackbar('Erreur lors de la sauvegarde', { variant: 'error' }),
  })

  if (!entry) return null

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        {entry.id ? 'Modifier le budget' : 'Définir un budget'}
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: entry.category.color }} />
          <Typography fontWeight="medium">{entry.category.name}</Typography>
        </Box>
        <TextField
          label="Plafond mensuel (€)"
          type="number"
          value={cap}
          onChange={e => setCap(e.target.value)}
          fullWidth
          autoFocus
          inputProps={{ min: 1, step: 1 }}
          helperText={entry.spent > 0 ? `Dépensé ce mois : ${fmt(entry.spent)}` : undefined}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="contained" disabled={!isValid || isPending} onClick={() => mutate()}>
          Enregistrer
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Budget card ──────────────────────────────────────────────────────────────

interface BudgetCardProps {
  entry: BudgetEntry
  onEdit: (entry: BudgetEntry) => void
  onDelete: (id: string) => void
}

function BudgetCard({ entry, onEdit, onDelete }: BudgetCardProps) {
  const pct = entry.percentOfBudget ?? 0
  const color = entry.cap != null ? budgetColor(pct) : 'inherit'

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <Box
              sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: entry.category.color, flexShrink: 0 }}
            />
            <Typography variant="subtitle2" noWrap>
              {entry.category.name}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
            {entry.id && (
              <>
                <IconButton size="small" onClick={() => onEdit(entry)}>
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" color="error" onClick={() => onDelete(entry.id!)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </>
            )}
          </Box>
        </Box>

        {entry.cap != null ? (
          <>
            {/* Amounts */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
              <Typography variant="h6" fontWeight="bold" color={`${color}.main`}>
                {fmt(entry.spent)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                / {fmt(entry.cap)}
              </Typography>
            </Box>

            {/* Progress bar */}
            <LinearProgress
              variant="determinate"
              value={Math.min(pct, 100)}
              color={color === 'inherit' ? 'primary' : color}
              sx={{ height: 6, borderRadius: 3, mb: 0.5 }}
            />

            {/* Percent + status chip */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                {Math.round(pct)}%
              </Typography>
              {pct >= 100 && <Chip label="Dépassé" size="small" color="error" />}
              {pct >= 80 && pct < 100 && <Chip label="Limite" size="small" color="warning" />}
              {pct > 0 && pct < 80 && (
                <Typography variant="caption" color="success.main">
                  Reste {fmt(entry.cap - entry.spent)}
                </Typography>
              )}
            </Box>
          </>
        ) : (
          /* No budget state */
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Dépensé ce mois : <strong>{fmt(entry.spent)}</strong>
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              fullWidth
              onClick={() => onEdit(entry)}
            >
              Définir un budget
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BudgetsPage() {
  const { enqueueSnackbar } = useSnackbar()
  const queryClient = useQueryClient()
  const { month, setMonth, monthOptions } = useMonthSelector()
  const [editEntry, setEditEntry] = useState<BudgetEntry | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['budgets', month],
    queryFn: () => fetchBudgets(month),
  })

  const { mutate: doDelete } = useMutation({
    mutationFn: deleteBudget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      enqueueSnackbar('Budget supprimé', { variant: 'success' })
    },
    onError: () => enqueueSnackbar('Erreur lors de la suppression', { variant: 'error' }),
  })

  function openCreate(entry: BudgetEntry) {
    setEditEntry({ ...entry, cap: null, id: null })
  }

  const totalBudgeted = data?.budgeted.reduce((s, b) => s + (b.cap ?? 0), 0) ?? 0
  const totalSpent = data?.budgeted.reduce((s, b) => s + b.spent, 0) ?? 0

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          Budgets
        </Typography>
        <Select
          value={month}
          onChange={e => setMonth(e.target.value)}
          size="small"
          sx={{ minWidth: 150 }}
        >
          {monthOptions.map(m => (
            <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
          ))}
        </Select>
      </Box>

      {/* Summary strip */}
      {!isLoading && data && data.budgeted.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            gap: 3,
            p: 2,
            mb: 3,
            bgcolor: 'background.paper',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box>
            <Typography variant="caption" color="text.secondary">Dépensé</Typography>
            <Typography fontWeight="bold">{fmt(totalSpent)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Budgeté</Typography>
            <Typography fontWeight="bold">{fmt(totalBudgeted)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Restant</Typography>
            <Typography fontWeight="bold" color={totalBudgeted - totalSpent >= 0 ? 'success.main' : 'error.main'}>
              {fmt(totalBudgeted - totalSpent)}
            </Typography>
          </Box>
        </Box>
      )}

      {/* Budgeted categories */}
      {isLoading ? (
        <Grid container spacing={2}>
          {[...Array(4)].map((_, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Skeleton variant="rounded" height={140} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <>
          {data!.budgeted.length > 0 && (
            <Grid container spacing={2} sx={{ mb: 4 }}>
              {data!.budgeted.map(entry => (
                <Grid item xs={12} sm={6} md={4} key={entry.categoryId}>
                  <BudgetCard
                    entry={entry}
                    onEdit={setEditEntry}
                    onDelete={doDelete}
                  />
                </Grid>
              ))}
            </Grid>
          )}

          {/* Categories without a budget */}
          {data!.unbudgeted.length > 0 && (
            <>
              <Divider sx={{ mb: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  Sans budget défini
                </Typography>
              </Divider>
              <Grid container spacing={2}>
                {data!.unbudgeted.map(entry => (
                  <Grid item xs={12} sm={6} md={4} key={entry.categoryId}>
                    <BudgetCard
                      entry={entry}
                      onEdit={openCreate}
                      onDelete={doDelete}
                    />
                  </Grid>
                ))}
              </Grid>
            </>
          )}

          {data!.budgeted.length === 0 && data!.unbudgeted.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography color="text.secondary">
                Aucune dépense catégorisée pour ce mois.
              </Typography>
            </Box>
          )}
        </>
      )}

      <BudgetDialog
        entry={editEntry}
        onClose={() => setEditEntry(null)}
      />
    </Box>
  )
}
