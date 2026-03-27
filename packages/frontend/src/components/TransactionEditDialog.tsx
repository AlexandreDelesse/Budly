import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Divider from '@mui/material/Divider'
import Autocomplete from '@mui/material/Autocomplete'
import Chip from '@mui/material/Chip'
import AddIcon from '@mui/icons-material/Add'
import { patchTransaction, type Transaction } from '../api/transactions'
import { createTag, type Tag } from '../api/tags'
import type { Category } from '../api/categories'
import type { ExpenseType } from '../api/merchants'

const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  FIXED_RECURRING: 'Fixe',
  VARIABLE_RECURRING: 'Variable',
  ONE_TIME: 'Ponctuel',
  UNKNOWN: '—',
}

function formatAmount(amount: string | number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(amount))
}

interface Props {
  open: boolean
  onClose: () => void
  transaction: Transaction | null
  categories: Category[]
  allTags: Tag[]
}

export default function TransactionEditDialog({ open, onClose, transaction, categories, allTags }: Props) {
  const { enqueueSnackbar } = useSnackbar()
  const queryClient = useQueryClient()

  const [categoryId, setCategoryId] = useState<string>('')
  const [expenseType, setExpenseType] = useState<ExpenseType>('VARIABLE_RECURRING')
  const [note, setNote] = useState<string>('')
  const [selectedTags, setSelectedTags] = useState<Tag[]>([])
  const [tagInputValue, setTagInputValue] = useState('')

  // Sync state when transaction changes
  useEffect(() => {
    if (transaction) {
      setCategoryId(transaction.categoryId ?? '')
      setExpenseType(
        transaction.expenseType === 'UNKNOWN' ? 'VARIABLE_RECURRING' : transaction.expenseType
      )
      setNote(transaction.note ?? '')
      setSelectedTags(transaction.tags.map(tt => tt.tag))
    }
  }, [transaction])

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      patchTransaction(transaction!.id, {
        categoryId: categoryId || null,
        expenseType,
        note,
        tagIds: selectedTags.map(t => t.id),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['uncategorized-grouped'] })
      enqueueSnackbar('Transaction mise à jour', { variant: 'success' })
      onClose()
    },
    onError: () => enqueueSnackbar('Erreur lors de la sauvegarde', { variant: 'error' }),
  })

  const { mutate: createNewTag, isPending: creatingTag } = useMutation({
    mutationFn: (name: string) => createTag({ name }),
    onSuccess: tag => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      setSelectedTags(prev => [...prev, tag])
      setTagInputValue('')
    },
    onError: () => enqueueSnackbar('Erreur lors de la création du tag', { variant: 'error' }),
  })

  if (!transaction) return null

  const selectedCategory = categories.find(c => c.id === categoryId)

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Éditer la transaction</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2 }}>
        {/* Transaction info (readonly) */}
        <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            {new Date(transaction.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </Typography>
          <Typography variant="body2" noWrap title={transaction.label}>
            {transaction.label}
          </Typography>
          <Typography variant="subtitle2" fontWeight="bold" color={Number(transaction.amount) < 0 ? 'error.main' : 'success.main'}>
            {formatAmount(transaction.amount)}
          </Typography>
        </Box>

        <Divider />

        {/* Category */}
        <FormControl fullWidth size="small">
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
                <em>Aucune</em>
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
          </Select>
        </FormControl>

        {/* Expense type */}
        <Box>
          <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
            Type de dépense
          </Typography>
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
        </Box>

        {/* Tags */}
        <Autocomplete
          multiple
          options={allTags}
          value={selectedTags}
          inputValue={tagInputValue}
          onInputChange={(_e, val) => setTagInputValue(val)}
          onChange={(_e, newValue) => setSelectedTags(newValue)}
          getOptionLabel={opt => opt.name}
          isOptionEqualToValue={(opt, val) => opt.id === val.id}
          freeSolo={false}
          filterSelectedOptions
          renderTags={(value, getTagProps) =>
            value.map((tag, index) => (
              <Chip
                key={tag.id}
                label={tag.name}
                size="small"
                style={{ backgroundColor: tag.color, color: '#fff' }}
                {...getTagProps({ index })}
              />
            ))
          }
          renderInput={params => (
            <TextField {...params} label="Étiquettes" size="small" placeholder="Rechercher ou créer…" />
          )}
          noOptionsText={
            tagInputValue.trim() ? (
              <Box
                component="span"
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', color: 'primary.main' }}
                onMouseDown={e => {
                  e.preventDefault()
                  if (tagInputValue.trim() && !creatingTag) {
                    createNewTag(tagInputValue.trim())
                  }
                }}
              >
                <AddIcon fontSize="small" />
                Créer « {tagInputValue.trim()} »
              </Box>
            ) : 'Aucun tag'
          }
        />

        {/* Note */}
        <TextField
          label="Note"
          value={note}
          onChange={e => setNote(e.target.value)}
          multiline
          rows={3}
          size="small"
          fullWidth
          placeholder="Ajouter une note libre…"
          inputProps={{ maxLength: 500 }}
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="contained" onClick={() => mutate()} disabled={isPending}>
          Sauvegarder
        </Button>
      </DialogActions>
    </Dialog>
  )
}
