import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormGroup from '@mui/material/FormGroup'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { fetchTrends } from '../../api/analytics'

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)

function formatMonthLabel(monthYear: string) {
  const [year, month] = monthYear.split('-').map(Number)
  const d = new Date(year, month - 1, 1)
  return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}

export default function TrendsPage() {
  const [monthCount, setMonthCount] = useState<number>(6)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [initialized, setInitialized] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['trends', monthCount],
    queryFn: () => fetchTrends(monthCount),
    select: data => {
      // On first load, select all categories
      if (!initialized && data.series.length > 0) {
        setSelectedIds(new Set(data.series.map(s => s.categoryId)))
        setInitialized(true)
      }
      return data
    },
  })

  function toggleCategory(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const visibleSeries = data?.series.filter(s => selectedIds.has(s.categoryId)) ?? []

  // Build chart data: one object per month with each category as a key
  const chartData = (data?.months ?? []).map((month, i) => {
    const point: Record<string, unknown> = { month: formatMonthLabel(month) }
    for (const series of visibleSeries) {
      point[series.name] = series.values[i] || null
    }
    return point
  })

  const driftingSeries = (data?.series ?? []).filter(s => s.drifting)

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          Tendances
        </Typography>
        <ToggleButtonGroup
          value={monthCount}
          exclusive
          onChange={(_e, val) => { if (val) setMonthCount(val) }}
          size="small"
        >
          <ToggleButton value={3}>3 mois</ToggleButton>
          <ToggleButton value={6}>6 mois</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Category filter */}
      {!isLoading && data && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <FormGroup row sx={{ gap: 0 }}>
              {data.series.map(s => (
                <FormControlLabel
                  key={s.categoryId}
                  control={
                    <Checkbox
                      checked={selectedIds.has(s.categoryId)}
                      onChange={() => toggleCategory(s.categoryId)}
                      size="small"
                      sx={{ color: s.color, '&.Mui-checked': { color: s.color } }}
                    />
                  }
                  label={
                    <Typography variant="body2">{s.name}</Typography>
                  }
                  sx={{ mr: 2 }}
                />
              ))}
            </FormGroup>
          </CardContent>
        </Card>
      )}

      {/* Line chart */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Évolution des dépenses par catégorie
          </Typography>
          {isLoading ? (
            <Skeleton variant="rectangular" height={300} />
          ) : visibleSeries.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography color="text.disabled" variant="body2">
                Sélectionnez au moins une catégorie
              </Typography>
            </Box>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={v => `${v}€`}
                  width={60}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [fmt(value), name]}
                />
                <Legend />
                {visibleSeries.map(s => (
                  <Line
                    key={s.categoryId}
                    type="monotone"
                    dataKey={s.name}
                    stroke={s.color}
                    strokeWidth={2}
                    dot={{ r: 4, fill: s.color }}
                    activeDot={{ r: 6 }}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Drift table */}
      {driftingSeries.length > 0 && (
        <Card variant="outlined">
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <TrendingUpIcon color="warning" />
              <Typography variant="subtitle2">
                Dépenses en hausse
              </Typography>
              <Chip
                label={`${driftingSeries.length} catégorie(s)`}
                size="small"
                color="warning"
                variant="outlined"
              />
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Catégorie</TableCell>
                    <TableCell align="right">Moy. 6 mois</TableCell>
                    <TableCell align="right">Moy. 3 mois</TableCell>
                    <TableCell align="right">Variation</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {driftingSeries.map(s => {
                    const delta = s.avg6 > 0
                      ? Math.round(((s.avg3 - s.avg6) / s.avg6) * 1000) / 10
                      : null
                    return (
                      <TableRow key={s.categoryId} sx={{ bgcolor: 'warning.50' }}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: s.color }} />
                            {s.name}
                          </Box>
                        </TableCell>
                        <TableCell align="right">{fmt(s.avg6)}</TableCell>
                        <TableCell align="right">{fmt(s.avg3)}</TableCell>
                        <TableCell align="right">
                          <Chip
                            label={delta !== null ? `+${delta}%` : '—'}
                            size="small"
                            color="warning"
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  )
}
