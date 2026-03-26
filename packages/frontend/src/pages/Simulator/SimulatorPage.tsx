import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Slider from '@mui/material/Slider'
import Divider from '@mui/material/Divider'
import Skeleton from '@mui/material/Skeleton'
import SavingsIcon from '@mui/icons-material/Savings'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { fetchSimulator } from '../../api/analytics'
import { fetchCategories } from '../../api/categories'

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)

function formatMonthLabel(monthYear: string) {
  const [year, month] = monthYear.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}

export default function SimulatorPage() {
  const [categoryId, setCategoryId] = useState<string>('')
  const [targetInput, setTargetInput] = useState<string>('')

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  })

  const targetAmount = parseFloat(targetInput)
  const hasValidTarget = !isNaN(targetAmount) && targetAmount >= 0

  const { data, isLoading } = useQuery({
    queryKey: ['simulator', categoryId, hasValidTarget ? targetAmount : null],
    queryFn: () => fetchSimulator(categoryId, hasValidTarget ? targetAmount : 0),
    enabled: !!categoryId,
  })

  // When data loads for the first time, pre-fill target with current avg
  function handleCategoryChange(id: string) {
    setCategoryId(id)
    setTargetInput('')
  }

  const displayTarget = hasValidTarget ? targetAmount : (data?.currentMonthlyAvg ?? 0)
  const sliderMax = data ? Math.ceil(data.currentMonthlyAvg * 1.5 / 50) * 50 : 500

  // Chart: bars for history + a "target" bar
  const chartData = [
    ...(data?.history ?? []).map(h => ({
      name: formatMonthLabel(h.month),
      actual: h.actual,
      isTarget: false,
    })),
    ...(hasValidTarget
      ? [{ name: 'Objectif', actual: targetAmount, isTarget: true }]
      : []),
  ]

  const selectedCategory = categories.find(c => c.id === categoryId)

  return (
    <Box sx={{ maxWidth: 800 }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        Simulateur d'économies
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Choisissez une catégorie, fixez un objectif de dépense mensuel et découvrez
        combien vous pourriez économiser.
      </Typography>

      {/* Step 1: Category */}
      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel>Catégorie</InputLabel>
        <Select
          value={categoryId}
          label="Catégorie"
          onChange={e => handleCategoryChange(e.target.value)}
          renderValue={() =>
            selectedCategory ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: selectedCategory.color }} />
                {selectedCategory.name}
              </Box>
            ) : <em>Choisir une catégorie…</em>
          }
        >
          {categories.map(cat => (
            <MenuItem key={cat.id} value={cat.id}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: cat.color }} />
                {cat.name}
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {!categoryId && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <SavingsIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">
            Sélectionnez une catégorie pour commencer
          </Typography>
        </Box>
      )}

      {categoryId && (
        <>
          {/* Step 2: Target amount */}
          {isLoading ? (
            <Skeleton variant="rounded" height={80} sx={{ mb: 3 }} />
          ) : data && (
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Moyenne actuelle :{' '}
                  <strong style={{ color: 'inherit' }}>{fmt(data.currentMonthlyAvg)} / mois</strong>
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', mt: 2 }}>
                  <TextField
                    label="Objectif mensuel"
                    type="number"
                    value={targetInput}
                    onChange={e => setTargetInput(e.target.value)}
                    placeholder={String(Math.round(data.currentMonthlyAvg * 0.7))}
                    size="small"
                    sx={{ width: 160 }}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">€</InputAdornment>,
                    }}
                    inputProps={{ min: 0, step: 5 }}
                  />
                </Box>

                <Slider
                  value={hasValidTarget ? targetAmount : data.currentMonthlyAvg}
                  onChange={(_e, v) => setTargetInput(String(v))}
                  min={0}
                  max={sliderMax}
                  step={5}
                  marks={[
                    { value: 0, label: '0€' },
                    { value: sliderMax, label: `${sliderMax}€` },
                  ]}
                  sx={{ mt: 2, color: selectedCategory?.color }}
                />
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {isLoading ? (
            <Skeleton variant="rounded" height={120} sx={{ mb: 3 }} />
          ) : data && hasValidTarget && displayTarget < data.currentMonthlyAvg && (
            <>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined" sx={{ bgcolor: 'success.50', borderColor: 'success.main' }}>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">
                        Économie par mois
                      </Typography>
                      <Typography variant="h4" fontWeight="bold" color="success.main">
                        {fmt(data.monthlySaving)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined" sx={{ bgcolor: 'success.50', borderColor: 'success.main' }}>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">
                        Économie par an
                      </Typography>
                      <Typography variant="h4" fontWeight="bold" color="success.main">
                        {fmt(data.yearlySaving)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Divider sx={{ mb: 3 }} />
            </>
          )}

          {/* Bar chart: history + target */}
          {data && data.history.length > 0 && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Historique des dépenses
                </Typography>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${v}€`} width={55} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    {hasValidTarget && (
                      <ReferenceLine
                        y={targetAmount}
                        stroke="#2e7d32"
                        strokeDasharray="6 3"
                        label={{ value: 'Objectif', position: 'insideTopRight', fontSize: 11, fill: '#2e7d32' }}
                      />
                    )}
                    <Bar dataKey="actual" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.isTarget ? '#2e7d32' : (selectedCategory?.color ?? '#1976d2')}
                          opacity={entry.isTarget ? 0.7 : 1}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
  )
}
