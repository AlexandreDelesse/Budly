import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import LabelIcon from '@mui/icons-material/Label'
import DashboardIcon from '@mui/icons-material/Dashboard'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import SavingsIcon from '@mui/icons-material/Savings'
import TimelineIcon from '@mui/icons-material/Timeline'
import { useLocation, useNavigate } from 'react-router-dom'

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
  { label: 'Importer', path: '/import', icon: <UploadFileIcon /> },
  { label: 'Catégoriser', path: '/categorize', icon: <LabelIcon /> },
  { label: 'Tendances', path: '/trends', icon: <TrendingUpIcon /> },
  { label: 'Budgets', path: '/budgets', icon: <AccountBalanceWalletIcon /> },
  { label: 'Simulateur', path: '/simulator', icon: <SavingsIcon /> },
  { label: 'Projection', path: '/projection', icon: <TimelineIcon /> },
]

interface SidebarProps {
  width: number
}

export default function Sidebar({ width }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <Drawer
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        '& .MuiDrawer-paper': { width, boxSizing: 'border-box' },
      }}
    >
      <Box sx={{ p: 2, pb: 1 }}>
        <Typography variant="h6" fontWeight="bold" color="primary">
          Budly
        </Typography>
      </Box>
      <List dense>
        {NAV_ITEMS.map(({ label, path, icon }) => (
          <ListItem key={path} disablePadding>
            <ListItemButton
              selected={location.pathname === path}
              onClick={() => navigate(path)}
              sx={{ borderRadius: 1, mx: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>{icon}</ListItemIcon>
              <ListItemText primary={label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Drawer>
  )
}
