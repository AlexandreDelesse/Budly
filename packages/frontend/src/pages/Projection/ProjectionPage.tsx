import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import Skeleton from '@mui/material/Skeleton'
import Chip from '@mui/material/Chip'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import EventRepeatIcon from '@mui/icons-material/EventRepeat'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { fetchProjection } from '../../api/analytics'

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)

function todayStr() {
  const d = new Date()
  return d.toISOString().split('T')[0]
}

function formatDateLabel(dateStr: string) {
  const [, month, day] = dateStr.split('-')
  return `${day}/${month}`
}

export default function ProjectionPage() {
  const [showFixed, setShowFixed] = useState(true)
  const today = todayStr()

  const { data, isLoading } = useQuery({
    queryKey: ['projection', today],
    queryFn: () => fetchProjection(today),
    staleTime: 5 * 60 * 1000, // 5 min
  })

  // Thin out x-axis labels (show every 5 days)
  const chartData = (data?.days ?? []).map((d, i) => ({
    ...d,
    label: i % 5 === 0 ? formatDateLabel(d.date) : '',
  }))

  const todayBalance = data?.days[0]?.balance ?? null
  const eomBalance = data?.endOfMonthBalance ?? null
  const isPositive = eomBalance !== null && eomBalance >= 0

  // Reference line at today
  const todayLabel = formatDateLabel(today)

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        Projection du solde
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Estimation sur 30 jours basée sur vos dépenses récurrentes et votre moyenne variable.
      </Typography>

      {/* KPIs */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          {isLoading ? (
            <Skeleton variant="rounded" height={90} />
          ) : (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="caption" color="text.secondary" display="block">
                  Solde actuel
                </Typography>
                <Typography variant="h5" fontWeight="bold">
                  {todayBalance !== null ? fmt(data!.currentBalance) : '—'}
                </Typography>
              </CardContent>
            </Card>
          )}
        </Grid>
        <Grid item xs={12} sm={4}>
          {isLoading ? (
            <Skeleton variant="rounded" height={90} />
          ) : (
            <Card
              variant="outlined"
              sx={{ borderColor: isPositive ? 'success.main' : 'error.main' }}
            >
              <CardContent>
                <Typography variant="caption" color="text.secondary" display="block">
                  Solde fin de mois (estimé)
                </Typography>
                <Typography
                  variant="h5"
                  fontWeight="bold"
                  color={isPositive ? 'success.main' : 'error.main'}
                >
                  {eomBalance !== null ? fmt(eomBalance) : '—'}
                </Typography>
              </CardContent>
            </Card>
          )}
        </Grid>
        <Grid item xs={12} sm={4}>
          {isLoading ? (
            <Skeleton variant="rounded" height={90} />
          ) : (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="caption" color="text.secondary" display="block">
                  Récurrents fixes programmés
                </Typography>
                <Typography variant="h5" fontWeight="bold">
                  {data?.scheduledFixed.length ?? 0}
                </Typography>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Area chart */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Évolution du solde sur 30 jours
          </Typography>
          {isLoading ? (
            <Skeleton variant="rectangular" height={300} />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1976d2" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#1976d2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={v => `${v}€`}
                  width={65}
                />
                <Tooltip
                  formatter={(v: number) => [fmt(v), 'Solde']}
                  labelFormatter={(_label, payload) => {
                    if (payload && payload[0]) {
                      return formatDateLabel((payload[0].payload as { date: string }).date)
                    }
                    return ''
                  }}
                />
                {/* Zero reference line */}
                <ReferenceLine y={0} stroke="#ef5350" strokeDasharray="4 2" />
                {/* Today marker */}
                <ReferenceLine
                  x={todayLabel}
                  stroke="#1976d2"
                  strokeDasharray="4 2"
                  label={{ value: "Auj.", position: 'top', fontSize: 11, fill: '#1976d2' }}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#1976d2"
                  strokeWidth={2}
                  fill="url(#balanceGrad)"
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Scheduled fixed transactions */}
      {!isLoading && data && data.scheduledFixed.length > 0 && (
        <Card variant="outlined">
          <CardContent>
            <Box
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              onClick={() => setShowFixed(v => !v)}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EventRepeatIcon color="action" />
                <Typography variant="subtitle2">
                  Récurrents fixes programmés
                </Typography>
                <Chip label={data.scheduledFixed.length} size="small" variant="outlined" />
              </Box>
              <IconButton size="small">
                {showFixed ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>

            <Collapse in={showFixed}>
              <TableContainer sx={{ mt: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Marchand</TableCell>
                      <TableCell>Date prévue</TableCell>
                      <TableCell align="right">Montant</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.scheduledFixed
                      .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate))
                      .map((item, i) => (
                        <TableRow key={i} hover>
                          <TableCell>{item.merchantName}</TableCell>
                          <TableCell>
                            {new Date(item.expectedDate + 'T00:00:00').toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: 'long',
                            })}
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'error.main', fontWeight: 'medium' }}>
                            -{fmt(item.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Collapse>
          </CardContent>
        </Card>
      )}
    </Box>
  )
}
