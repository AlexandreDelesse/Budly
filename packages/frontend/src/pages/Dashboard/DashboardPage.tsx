import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import LinearProgress from '@mui/material/LinearProgress'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { fetchDashboard, type CategoryBreakdown } from '../../api/analytics'
import { useMonthSelector } from '../../hooks/useMonthSelector'

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)

function budgetColor(pct: number) {
  if (pct >= 100) return 'error'
  if (pct >= 80) return 'warning'
  return 'success'
}

// ─── KPI card ────────────────────────────────────────────────────────────────

interface KpiCardProps {
  title: string
  value: number
  color?: string
  delta?: number | null
}

function KpiCard({ title, value, color, delta }: KpiCardProps) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
          {title}
        </Typography>
        <Typography variant="h5" fontWeight="bold" color={color ?? 'text.primary'}>
          {fmt(value)}
        </Typography>
        {delta !== undefined && delta !== null && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
            {delta > 0 ? (
              <TrendingUpIcon fontSize="small" color="error" />
            ) : (
              <TrendingDownIcon fontSize="small" color="success" />
            )}
            <Typography variant="caption" color={delta > 0 ? 'error.main' : 'success.main'}>
              {delta > 0 ? '+' : ''}{delta}% vs mois précédent
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Category row ─────────────────────────────────────────────────────────────

function CategoryRow({ cat }: { cat: CategoryBreakdown }) {
  const pct = cat.percentOfBudget

  return (
    <Box sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: cat.color, flexShrink: 0 }} />
          <Typography variant="body2">{cat.name}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" fontWeight="medium">
            {fmt(Math.abs(cat.amount))}
          </Typography>
          {cat.budget !== null && (
            <Typography variant="caption" color="text.disabled">
              / {fmt(cat.budget)}
            </Typography>
          )}
          {pct !== null && pct >= 100 && (
            <Chip label="Dépassé" size="small" color="error" />
          )}
          {pct !== null && pct >= 80 && pct < 100 && (
            <Chip label="Proche" size="small" color="warning" />
          )}
        </Box>
      </Box>
      {cat.budget !== null && pct !== null && (
        <LinearProgress
          variant="determinate"
          value={Math.min(pct, 100)}
          color={budgetColor(pct)}
          sx={{ height: 4, borderRadius: 2 }}
        />
      )}
    </Box>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { enqueueSnackbar } = useSnackbar()
  const { month, setMonth, monthOptions } = useMonthSelector()

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', month],
    queryFn: () => fetchDashboard(month),
  })

  // Overspend alerts on data load
  useEffect(() => {
    if (!data) return
    const over = data.byCategory.filter(c => c.percentOfBudget !== null && c.percentOfBudget >= 100)
    over.forEach(c => {
      enqueueSnackbar(`Budget dépassé : ${c.name} (${fmt(Math.abs(c.amount))} / ${fmt(c.budget!)})`, {
        variant: 'error',
        preventDuplicate: true,
        key: `overspend-${c.categoryId}-${month}`,
      })
    })
  }, [data, enqueueSnackbar, month])

  const pieData = data?.byCategory.map(c => ({
    name: c.name,
    value: Math.abs(c.amount),
    color: c.color,
  })) ?? []

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          Dashboard
        </Typography>
        <Select
          value={month}
          onChange={e => setMonth(e.target.value)}
          size="small"
          sx={{ minWidth: 150 }}
        >
          {monthOptions.map(m => (
            <MenuItem key={m.value} value={m.value}>
              {m.label}
            </MenuItem>
          ))}
        </Select>
      </Box>

      {/* KPI strip */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          {isLoading ? (
            <Skeleton variant="rounded" height={90} />
          ) : (
            <KpiCard title="Solde cumulé" value={data?.balance ?? 0} />
          )}
        </Grid>
        <Grid item xs={12} sm={4}>
          {isLoading ? (
            <Skeleton variant="rounded" height={90} />
          ) : (
            <KpiCard
              title="Dépenses"
              value={data?.totalExpenses ?? 0}
              color="error.main"
              delta={data?.prevMonth.delta}
            />
          )}
        </Grid>
        <Grid item xs={12} sm={4}>
          {isLoading ? (
            <Skeleton variant="rounded" height={90} />
          ) : (
            <KpiCard title="Revenus" value={data?.totalIncome ?? 0} color="success.main" />
          )}
        </Grid>
      </Grid>

      {/* Chart + categories */}
      <Grid container spacing={3}>
        {/* Donut chart */}
        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Répartition par catégorie
              </Typography>
              {isLoading ? (
                <Skeleton variant="circular" width={220} height={220} sx={{ mx: 'auto' }} />
              ) : pieData.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <Typography color="text.disabled" variant="body2">
                    Aucune dépense catégorisée ce mois
                  </Typography>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => fmt(value)}
                    />
                    <Legend
                      formatter={(value) => (
                        <Typography component="span" variant="caption">{value}</Typography>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Category list */}
        <Grid item xs={12} md={7}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Détail par catégorie
              </Typography>
              {isLoading ? (
                [...Array(5)].map((_, i) => <Skeleton key={i} height={48} sx={{ mb: 0.5 }} />)
              ) : data?.byCategory.length === 0 ? (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography color="text.disabled" variant="body2">
                    Aucune dépense ce mois
                  </Typography>
                </Box>
              ) : (
                <>
                  {data?.byCategory.map(cat => (
                    <CategoryRow key={cat.categoryId} cat={cat} />
                  ))}
                  {(data?.uncategorizedAmount ?? 0) < 0 && (
                    <Box sx={{ py: 1.5, display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.disabled">
                        Non catégorisé
                      </Typography>
                      <Typography variant="body2" color="text.disabled">
                        {fmt(Math.abs(data!.uncategorizedAmount))}
                      </Typography>
                    </Box>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
