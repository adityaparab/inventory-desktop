import DownloadIcon from '@mui/icons-material/Download'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Toolbar from '@mui/material/Toolbar'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { AuthUser } from '../../types'
import AccountMenu from './AccountMenu'

interface DashboardHeaderProps {
  user: AuthUser
  onLogout: () => void
  showSetupButton: boolean
  isDownloadingSetup: boolean
  onDownloadSetup: () => void
}

export default function DashboardHeader({
  user,
  onLogout,
  showSetupButton,
  isDownloadingSetup,
  onDownloadSetup,
}: DashboardHeaderProps) {
  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
    >
      <Toolbar sx={{ gap: 2, px: { xs: 2, md: 3 } }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 2,
            color: 'primary.contrastText',
            bgcolor: 'primary.main',
            flex: '0 0 auto',
          }}
        >
          <Inventory2Icon />
        </Box>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="h6" noWrap>
            Inventory Build Console
          </Typography>
        </Box>
        {showSetupButton && (
          <Tooltip
            title="Downloads a personalised setup program. Run it on the target machine to register, build, and install Inventory."
            arrow
          >
            <span>
              <Button
              variant="outlined"
              size="small"
              startIcon={
                isDownloadingSetup ? (
                  <CircularProgress size={14} color="inherit" />
                ) : (
                  <DownloadIcon fontSize="small" />
                )
              }
              disabled={isDownloadingSetup}
              onClick={onDownloadSetup}
              sx={{ mr: 1, whiteSpace: 'nowrap' }}
            >
              {isDownloadingSetup ? 'Preparing…' : 'Download Setup'}
            </Button>
          </span>
        </Tooltip>)}
        <AccountMenu user={user} onLogout={onLogout} />
      </Toolbar>
    </AppBar>
  )
}