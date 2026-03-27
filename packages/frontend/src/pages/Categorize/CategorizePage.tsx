import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import Grid from '@mui/material/Grid'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Collapse from '@mui/material/Collapse'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import AddIcon from '@mui/icons-material/Add'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import EditIcon from '@mui/icons-material/Edit'
import { fetchCategories, type Category } from '../../api/categories'
import { fetchUncategorizedGrouped, patchMerchant, type MerchantGroup, type ExpenseType } from '../../api/merchants'
import { fetchTransactions, type Transaction } from '../../api/transactions'
import { fetchTags } from '../../api/tags'
import CategoryDialog from '../../components/CategoryDialog'
import TransactionEditDialog from '../../components/TransactionEditDialog'

const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  FIXED_RECURRING: 'Fixe',
  VARIABLE_RECURRING: 'Variable',
  ONE_TIME: 'Ponctuel',
  UNKNOWN: '—',
}

function formatAmount(amount: string | number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(amount))
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ─── Transaction rows (lazy-loaded per merchant) ───────────────────────────

interface TransactionRowsProps {
  merchantId: string
  categories: Category[]
  onEditTransaction: (tx: Transaction) => void
}

function TransactionRows({ merchantId, categories, onEditTransaction }: TransactionRowsProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['transactions', { merchantId }],
    queryFn: () => fetchTransactions({ merchantId, limit: 100 }),
  })

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={20} />
      </Box>
    )
  }

  const transactions = data?.transactions ?? []

  return (
    <Table size="small">
      <TableBody>
        {transactions.map(tx => {
          const cat = categories.find(c => c.id === tx.categoryId)
          return (
            <TableRow key={tx.id} hover>
              <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap', fontSize: '0.75rem', pl: 1 }}>
                {formatDate(tx.date)}
              </TableCell>
              <TableCell sx={{ fontSize: '0.75rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <Tooltip title={tx.label}>
                  <span>{tx.label}</span>
                </Tooltip>
              </TableCell>
              <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontSize: '0.75rem', fontWeight: 'medium', color: Number(tx.amount) < 0 ? 'error.main' : 'success.main' }}>
                {formatAmount(tx.amount)}
              </TableCell>
              <TableCell sx={{ maxWidth: 120 }}>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                  {cat && (
                    <Chip
                      label={cat.name}
                      size="small"
                      sx={{ bgcolor: cat.color, color: '#fff', fontSize: '0.65rem', height: 18 }}
                    />
                  )}
                  {tx.tags.map(tt => (
                    <Chip
                      key={tt.tagId}
                      label={tt.tag.name}
                      size="small"
                      sx={{ bgcolor: tt.tag.color, color: '#fff', fontSize: '0.65rem', height: 18 }}
                    />
                  ))}
                  {tx.note && (
                    <Tooltip title={tx.note}>
                      <Typography component="span" variant="caption" color="text.disabled">💬</Typography>
                    </Tooltip>
                  )}
                </Box>
              </TableCell>
              <TableCell align="right" sx={{ pr: 0.5 }}>
                <IconButton size="small" onClick={() => onEditTransaction(tx)}>
                  <EditIcon fontSize="inherit" />
                </IconButton>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

// ─── Merchant Card ─────────────────────────────────────────────────────────

interface MerchantCardProps {
  group: MerchantGroup
  categories: Category[]
  onSaved: () => void
  onOpenCategoryDialog: (onCreated: (cat: Category) => void) => void
  onEditTransaction: (tx: Transaction) => void
}

function MerchantCard({ group, categories, onSaved, onOpenCategoryDialog, onEditTransaction }: MerchantCardProps) {
  const { enqueueSnackbar } = useSnackbar()
  const [categoryId, setCategoryId] = useState<string>(group.categoryId ?? '')
  const [expenseType, setExpenseType] = useState<ExpenseType>(
    group.expenseType === 'UNKNOWN' ? 'VARIABLE_RECURRING' : group.expenseType
  )
  const [expanded, setExpanded] = useState(false)

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      patchMerchant(group.merchantId, {
        categoryId: categoryId || null,
        expenseType,
      }),
    onSuccess: () => {
      enqueueSnackbar(`${group.merchantName} catégorisé`, { variant: 'success' })
      onSaved()
    },
    onError: () => enqueueSnackbar('Erreur lors de la sauvegarde', { variant: 'error' }),
  })

  const selectedCategory = categories.find(c => c.id === categoryId)

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            {group.merchantName}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip label={`${group.transactionCount} op.`} size="small" variant="outlined" />
            <Chip
              label={formatAmount(group.totalAmount)}
              size="small"
              color={Number(group.totalAmount) < 0 ? 'error' : 'success'}
              variant="outlined"
            />
          </Box>
        </Box>

        {/* Sample labels */}
        <Box sx={{ mb: 2 }}>
          {group.sampleLabels.map((label, i) => (
            <Typography key={i} variant="caption" color="text.disabled" display="block" noWrap>
              {label}
            </Typography>
          ))}
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Category select */}
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Catégorie</InputLabel>
          <Select
            value={categoryId}
            label="Catégorie"
            onChange={e => setCategoryId(e.target.value)}
            renderValue={() =>
              selectedCategory ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: selectedCategory.color, flexShrink: 0 }} />
                  {selectedCategory.name}
                </Box>
              ) : (
                <em>Choisir…</em>
              )
            }
          >
            <MenuItem value=""><em>Aucune</em></MenuItem>
            {categories.map(cat => (
              <MenuItem key={cat.id} value={cat.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: cat.color, flexShrink: 0 }} />
                  {cat.name}
                </Box>
              </MenuItem>
            ))}
            <Divider />
            <MenuItem
              onClick={e => {
                e.stopPropagation()
                onOpenCategoryDialog(cat => setCategoryId(cat.id))
              }}
            >
              <AddIcon fontSize="small" sx={{ mr: 1 }} />
              Nouvelle catégorie…
            </MenuItem>
          </Select>
        </FormControl>

        {/* Expense type */}
        <ToggleButtonGroup
          value={expenseType}
          exclusive
          onChange={(_e, val) => { if (val) setExpenseType(val) }}
          size="small"
          fullWidth
        >
          {(['FIXED_RECURRING', 'VARIABLE_RECURRING', 'ONE_TIME'] as ExpenseType[]).map(type => (
            <ToggleButton key={type} value={type} sx={{ fontSize: '0.7rem' }}>
              {EXPENSE_TYPE_LABELS[type]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </CardContent>

      <CardActions sx={{ px: 2, pb: expanded ? 0 : 2, flexDirection: 'column', gap: 1 }}>
        <Button
          variant="contained"
          fullWidth
          disabled={!categoryId || isPending}
          onClick={() => mutate()}
        >
          Enregistrer
        </Button>
        <Button
          fullWidth
          size="small"
          onClick={() => setExpanded(v => !v)}
          endIcon={
            <ExpandMoreIcon
              fontSize="small"
              sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
            />
          }
        >
          {expanded ? 'Masquer les lignes' : 'Voir les transactions'}
        </Button>
      </CardActions>

      {/* Expandable transaction list */}
      <Collapse in={expanded} unmountOnExit>
        <Divider />
        <Box sx={{ maxHeight: 280, overflowY: 'auto' }}>
          <TransactionRows
            merchantId={group.merchantId}
            categories={categories}
            onEditTransaction={onEditTransaction}
          />
        </Box>
        <Box sx={{ pb: 1 }} />
      </Collapse>
    </Card>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function CategorizePage() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [onCreatedCallback, setOnCreatedCallback] = useState<((cat: Category) => void) | null>(null)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)

  const { data: groups = [], isLoading: loadingGroups } = useQuery({
    queryKey: ['uncategorized-grouped'],
    queryFn: fetchUncategorizedGrouped,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  })

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: fetchTags,
  })

  function handleSaved() {
    queryClient.invalidateQueries({ queryKey: ['uncategorized-grouped'] })
  }

  function openCategoryDialog(onCreated: (cat: Category) => void) {
    setOnCreatedCallback(() => onCreated)
    setDialogOpen(true)
  }

  if (loadingGroups) return null

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          Catégoriser
        </Typography>
        {groups.length > 0 && (
          <Chip label={`${groups.length} marchand(s) à traiter`} color="warning" />
        )}
      </Box>

      {groups.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Tout est catégorisé !
          </Typography>
          <Typography color="text.secondary">
            Aucune transaction en attente de catégorisation.
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {groups.map(group => (
            <Grid item xs={12} sm={6} md={4} key={group.merchantId}>
              <MerchantCard
                group={group}
                categories={categories}
                onSaved={handleSaved}
                onOpenCategoryDialog={openCategoryDialog}
                onEditTransaction={setEditingTransaction}
              />
            </Grid>
          ))}
        </Grid>
      )}

      <CategoryDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={cat => {
          onCreatedCallback?.(cat)
          setOnCreatedCallback(null)
        }}
      />

      <TransactionEditDialog
        open={editingTransaction !== null}
        onClose={() => setEditingTransaction(null)}
        transaction={editingTransaction}
        categories={categories}
        allTags={allTags}
      />
    </Box>
  )
}
