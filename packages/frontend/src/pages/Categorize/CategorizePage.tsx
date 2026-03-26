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
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import AddIcon from '@mui/icons-material/Add'
import { fetchCategories, type Category } from '../../api/categories'
import { fetchUncategorizedGrouped, patchMerchant, type MerchantGroup, type ExpenseType } from '../../api/merchants'
import CategoryDialog from '../../components/CategoryDialog'

const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  FIXED_RECURRING: 'Fixe',
  VARIABLE_RECURRING: 'Variable',
  ONE_TIME: 'Ponctuel',
  UNKNOWN: '—',
}

function formatAmount(amount: string | number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(amount))
}

interface MerchantCardProps {
  group: MerchantGroup
  categories: Category[]
  onSaved: () => void
  onOpenCategoryDialog: (onCreated: (cat: Category) => void) => void
}

function MerchantCard({ group, categories, onSaved, onOpenCategoryDialog }: MerchantCardProps) {
  const { enqueueSnackbar } = useSnackbar()
  const [categoryId, setCategoryId] = useState<string>(group.categoryId ?? '')
  const [expenseType, setExpenseType] = useState<ExpenseType>(
    group.expenseType === 'UNKNOWN' ? 'VARIABLE_RECURRING' : group.expenseType
  )

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
            <Chip
              label={`${group.transactionCount} op.`}
              size="small"
              variant="outlined"
            />
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
                  <Box
                    sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: selectedCategory.color, flexShrink: 0 }}
                  />
                  {selectedCategory.name}
                </Box>
              ) : (
                <em>Choisir…</em>
              )
            }
          >
            <MenuItem value="">
              <em>Aucune</em>
            </MenuItem>
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

      <CardActions sx={{ px: 2, pb: 2 }}>
        <Button
          variant="contained"
          fullWidth
          disabled={!categoryId || isPending}
          onClick={() => mutate()}
        >
          Enregistrer
        </Button>
      </CardActions>
    </Card>
  )
}

export default function CategorizePage() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [onCreatedCallback, setOnCreatedCallback] = useState<((cat: Category) => void) | null>(null)

  const { data: groups = [], isLoading: loadingGroups } = useQuery({
    queryKey: ['uncategorized-grouped'],
    queryFn: fetchUncategorizedGrouped,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
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
    </Box>
  )
}
