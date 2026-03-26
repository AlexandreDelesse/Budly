import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import { useNavigate } from 'react-router-dom'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <Box sx={{ textAlign: 'center', py: 10 }}>
      <Typography variant="h2" fontWeight="bold" color="text.disabled" gutterBottom>
        404
      </Typography>
      <Typography variant="h6" color="text.secondary" gutterBottom>
        Page introuvable
      </Typography>
      <Button variant="contained" onClick={() => navigate('/dashboard')} sx={{ mt: 2 }}>
        Retour au dashboard
      </Button>
    </Box>
  )
}
