import AddIcon from '@mui/icons-material/Add'
import RefreshIcon from '@mui/icons-material/Refresh'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { BuildStatus } from '../../types'
import { formatDateTime } from '../../utils/formatters'
import BuildStatusChip from './BuildStatusChip'
import BuildsErrorState from './BuildsErrorState'
import EmptyBuildsState from './EmptyBuildsState'

export interface UuidEntry {
  uuid: string
  machineName: string | null
  latestStatus: BuildStatus
  buildCount: number
  lastActivity: string | null
}

interface UuidListPanelProps {
  entries: UuidEntry[]
  selectedUuid: string | null
  isLoading: boolean
  error: string | null
  onSelect: (uuid: string) => void
  onRefresh: () => void
  onAddUuid?: () => void
}

export default function UuidListPanel({
  entries,
  selectedUuid,
  isLoading,
  error,
  onSelect,
  onRefresh,
  onAddUuid,
}: UuidListPanelProps) {
  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Typography variant="h6">UUIDs</Typography>
        <Stack direction="row" spacing={0.5}>
          {onAddUuid && (
            <Tooltip title="Add UUID">
              <IconButton size="small" onClick={onAddUuid} aria-label="Add UUID">
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <IconButton size="small" onClick={onRefresh} disabled={isLoading} aria-label="Refresh list">
            {isLoading ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
          </IconButton>
        </Stack>
      </Stack>

      {error ? (
        <BuildsErrorState message={error} onRetry={onRefresh} />
      ) : entries.length === 0 && !isLoading ? (
        <EmptyBuildsState />
      ) : (
        <List disablePadding>
          {entries.map((entry) => (
            <ListItemButton
              key={entry.uuid}
              selected={entry.uuid === selectedUuid}
              onClick={() => onSelect(entry.uuid)}
              divider
              sx={{ px: 2, py: 1.5, flexDirection: 'column', alignItems: 'flex-start' }}
            >
              <Typography
                variant="body2"
                fontWeight={500}
                noWrap
                sx={{ mb: entry.machineName ? 0.25 : 0 }}
              >
                {entry.machineName ?? entry.uuid}
              </Typography>
              {entry.machineName && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
                    wordBreak: 'break-all',
                    fontSize: '0.68rem',
                    mb: 0.75,
                  }}
                >
                  {entry.uuid}
                </Typography>
              )}
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <BuildStatusChip status={entry.latestStatus} />
                <Typography variant="caption" color="text.secondary">
                  {entry.buildCount === 1 ? '1 build' : `${entry.buildCount} builds`}
                </Typography>
                {entry.lastActivity && (
                  <Typography variant="caption" color="text.secondary">
                    · {formatDateTime(entry.lastActivity)}
                  </Typography>
                )}
              </Stack>
            </ListItemButton>
          ))}
        </List>
      )}
    </Paper>
  )
}
