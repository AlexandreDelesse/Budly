import { useState } from 'react'
import Box from '@mui/material/Box'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import MenuIcon from '@mui/icons-material/Menu'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

const SIDEBAR_WIDTH = 220

export default function AppShell() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Mobile top AppBar */}
      {isMobile && (
        <AppBar
          position="fixed"
          elevation={0}
          sx={{ zIndex: theme.zIndex.drawer + 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', color: 'text.primary' }}
        >
          <Toolbar variant="dense">
            <IconButton edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 1 }}>
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" fontWeight="bold" color="primary">
              Budly
            </Typography>
          </Toolbar>
        </AppBar>
      )}

      <Sidebar
        width={SIDEBAR_WIDTH}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        isMobile={isMobile}
      />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3 },
          pt: isMobile ? '56px' : 3, // offset for mobile AppBar height
          minWidth: 0, // prevent flex overflow
        }}
      >
        <Outlet />
      </Box>
    </Box>
  )
}
