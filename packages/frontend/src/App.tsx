import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { SnackbarProvider } from 'notistack'
import theme from './theme'
import AppShell from './components/Layout/AppShell'
import ImportPage from './pages/Import/ImportPage'
import CategorizePage from './pages/Categorize/CategorizePage'
import DashboardPage from './pages/Dashboard/DashboardPage'
import TrendsPage from './pages/Trends/TrendsPage'
import BudgetsPage from './pages/Budgets/BudgetsPage'
import SimulatorPage from './pages/Simulator/SimulatorPage'
import ProjectionPage from './pages/Projection/ProjectionPage'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <BrowserRouter>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/import" element={<ImportPage />} />
                <Route path="/categorize" element={<CategorizePage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/trends" element={<TrendsPage />} />
                <Route path="/budgets" element={<BudgetsPage />} />
                <Route path="/simulator" element={<SimulatorPage />} />
                <Route path="/projection" element={<ProjectionPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </SnackbarProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
