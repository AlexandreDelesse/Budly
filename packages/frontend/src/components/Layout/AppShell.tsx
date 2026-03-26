import Box from '@mui/material/Box'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

const SIDEBAR_WIDTH = 220

export default function AppShell() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar width={SIDEBAR_WIDTH} />
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Outlet />
      </Box>
    </Box>
  )
}
