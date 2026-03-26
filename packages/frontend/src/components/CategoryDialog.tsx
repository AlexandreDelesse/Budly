import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import { createCategory, type Category } from '../api/categories'

const PRESET_COLORS = [
  '#E53935', '#D81B60', '#8E24AA', '#3949AB',
  '#1E88E5', '#00ACC1', '#00897B', '#43A047',
  '#7CB342', '#F4511E', '#FB8C00', '#FFB300',
  '#6D4C41', '#757575', '#546E7A',
]

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (category: Category) => void
}

export default function CategoryDialog({ open, onClose, onCreated }: Props) {
  const { enqueueSnackbar } = useSnackbar()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [icon, setIcon] = useState('label')

  const { mutate, isPending } = useMutation({
    mutationFn: () => createCategory({ name, color, icon }),
    onSuccess: cat => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      enqueueSnackbar(`Catégorie "${cat.name}" créée`, { variant: 'success' })
      onCreated(cat)
      handleClose()
    },
    onError: () => enqueueSnackbar('Erreur lors de la création', { variant: 'error' }),
  })

  function handleClose() {
    setName('')
    setColor(PRESET_COLORS[0])
    setIcon('label')
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Nouvelle catégorie</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        <TextField
          label="Nom"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
          fullWidth
          inputProps={{ maxLength: 50 }}
        />

        <Box>
          <Typography variant="caption" color="text.secondary" display="block" mb={1}>
            Couleur
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {PRESET_COLORS.map(c => (
              <Tooltip key={c} title={c}>
                <Box
                  onClick={() => setColor(c)}
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    bgcolor: c,
                    cursor: 'pointer',
                    border: color === c ? '3px solid white' : '3px solid transparent',
                    outline: color === c ? `2px solid ${c}` : 'none',
                    transition: 'outline 0.15s',
                  }}
                />
              </Tooltip>
            ))}
          </Box>
        </Box>

        <TextField
          label="Icône (nom MUI)"
          value={icon}
          onChange={e => setIcon(e.target.value)}
          fullWidth
          helperText='Ex : restaurant, directions_car, home, shopping_cart'
          inputProps={{ maxLength: 50 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Annuler</Button>
        <Button
          variant="contained"
          disabled={!name.trim() || isPending}
          onClick={() => mutate()}
        >
          Créer
        </Button>
      </DialogActions>
    </Dialog>
  )
}
