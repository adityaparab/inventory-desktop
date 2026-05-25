import { useState, type MouseEvent } from 'react'
import LogoutIcon from '@mui/icons-material/Logout'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { AuthUser } from '../../types'
import { formatUsername } from '../../utils/formatters'

interface AccountMenuProps {
  user: AuthUser
  onLogout: () => void
}

export default function AccountMenu({ user, onLogout }: AccountMenuProps) {
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null)
  const isMenuOpen = Boolean(anchorElement)
  const displayName = formatUsername(user.username) || user.username

  const handleOpen = (event: MouseEvent<HTMLElement>) => {
    setAnchorElement(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorElement(null)
  }

  const handleLogout = () => {
    handleClose()
    onLogout()
  }

  return (
    <Box>
      <Tooltip title="Account">
        <IconButton onClick={handleOpen} aria-controls="account-menu" aria-haspopup="true">
          <Avatar sx={{ width: 36, height: 36, bgcolor: 'secondary.main' }}>
            {user.username.charAt(0).toUpperCase()}
          </Avatar>
        </IconButton>
      </Tooltip>
      <Menu
        id="account-menu"
        anchorEl={anchorElement}
        open={isMenuOpen}
        onClose={handleClose}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
      >
        <MenuItem disabled sx={{ opacity: 1 }}>
          <Stack spacing={0.25} sx={{ minWidth: 220 }}>
            <Typography variant="subtitle2">{displayName}</Typography>
            <Typography color="text.secondary" variant="body2">
              {user.email}
            </Typography>
          </Stack>
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Logout</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  )
}