import { useCallback, useEffect, useMemo, useState } from 'react'
import CloseIcon from '@mui/icons-material/Close'
import DownloadIcon from '@mui/icons-material/Download'
import MonitorIcon from '@mui/icons-material/Monitor'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { downloadBuild, listBuilds, streamBuild, deleteBuild } from '../../api/buildApi'
import { downloadSetupScript } from '../../api/setupApi'
import { getErrorMessage } from '../../api/http'
import type { AuthSession, BuildRecord, BuildStreamEvent, DashboardNotice } from '../../types'
import { saveBlobAsFile } from '../../utils/download'
import BuildSummaryCards from './BuildSummaryCards'
import DashboardHeader from './DashboardHeader'
import DashboardSnackbar from './DashboardSnackbar'
import GenerateBuildForm from './GenerateBuildForm'
import UuidDetailPanel from './UuidDetailPanel'
import UuidListPanel, { type UuidEntry } from './UuidListPanel'

interface DashboardScreenProps {
  session: AuthSession
  onLogout: () => void
}

export default function DashboardScreen({ session, onLogout }: DashboardScreenProps) {
  const [records, setRecords] = useState<BuildRecord[]>([])
  const [isLoadingRecords, setIsLoadingRecords] = useState(true)
  const [recordsError, setRecordsError] = useState<string | null>(null)
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null)
  const [isAddingUuid, setIsAddingUuid] = useState(false)
  const [streamEvents, setStreamEvents] = useState<BuildStreamEvent[]>([])
  const [streamUuid, setStreamUuid] = useState<string | null>(null)
  const [activeUuid, setActiveUuid] = useState<string | null>(null)
  const [downloadingUuid, setDownloadingUuid] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<DashboardNotice | null>(null)
  const [isDownloadingSetup, setIsDownloadingSetup] = useState(false)

  const loadRecords = useCallback(async () => {
    setIsLoadingRecords(true)
    setRecordsError(null)
    try {
      setRecords(await listBuilds(session.token))
    } catch (requestError) {
      setRecordsError(getErrorMessage(requestError))
    } finally {
      setIsLoadingRecords(false)
    }
  }, [session.token])

  useEffect(() => {
    void Promise.resolve().then(loadRecords)
  }, [loadRecords])

  const uuidEntries = useMemo<UuidEntry[]>(() => {
    const map = new Map<string, BuildRecord[]>()
    for (const record of records) {
      const group = map.get(record.uuid) ?? []
      group.push(record)
      map.set(record.uuid, group)
    }
    return Array.from(map.entries())
      .map(([uuid, builds]) => {
        const sorted = [...builds].sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return tb - ta
        })
        return {
          uuid,
          machineName: sorted[0].machineName ?? null,
          latestStatus: sorted[0].status,
          buildCount: builds.length,
          lastActivity: sorted[0].createdAt,
        }
      })
      .sort((a, b) => {
        const ta = a.lastActivity ? new Date(a.lastActivity).getTime() : 0
        const tb = b.lastActivity ? new Date(b.lastActivity).getTime() : 0
        return tb - ta
      })
  }, [records])

  const selectedRecords = useMemo(
    () => (selectedUuid ? records.filter((r) => r.uuid === selectedUuid) : []),
    [records, selectedUuid],
  )

  const handleStreamEvent = useCallback((event: BuildStreamEvent) => {
    setStreamEvents((current) => [...current, event])
    if (event.type === 'complete') {
      setNotice({ severity: 'success', message: event.message })
    }
    if (event.type === 'error') {
      setNotice({ severity: 'error', message: event.message })
    }
  }, [])

  const handleGenerateBuild = useCallback(
    async (uuid: string) => {
      setActiveUuid(uuid)
      setSelectedUuid(uuid)
      setStreamUuid(uuid)
      setIsAddingUuid(false)
      setStreamEvents([])
      setNotice({ severity: 'info', message: `Build started for ${uuid}.` })
      try {
        await streamBuild(uuid, session.token, { onEvent: handleStreamEvent })
        await loadRecords()
      } catch (requestError) {
        const message = getErrorMessage(requestError)
        setStreamEvents((current) => [...current, { type: 'error', message }])
        setNotice({ severity: 'error', message })
        await loadRecords()
      } finally {
        setActiveUuid(null)
      }
    },
    [handleStreamEvent, loadRecords, session.token],
  )

  const handleDownloadBuild = useCallback(
    async (record: BuildRecord) => {
      setDownloadingUuid(record.uuid)
      try {
        const artifact = await downloadBuild(record.uuid, session.token)
        saveBlobAsFile(artifact.blob, artifact.filename)
        setNotice({ severity: 'success', message: `${artifact.filename} download started.` })
      } catch (requestError) {
        setNotice({ severity: 'error', message: getErrorMessage(requestError) })
      } finally {
        setDownloadingUuid(null)
      }
    },
    [session.token],
  )

  const handleDeleteBuild = useCallback(
    async (record: BuildRecord) => {
      setDeletingId(record.id)
      try {
        await deleteBuild(record.id, session.token)
        setNotice({ severity: 'success', message: 'Build record deleted.' })
        await loadRecords()
      } catch (requestError) {
        setNotice({ severity: 'error', message: getErrorMessage(requestError) })
      } finally {
        setDeletingId(null)
      }
    },
    [loadRecords, session.token],
  )

  const handleDismissNotice = useCallback(() => setNotice(null), [])

  const handleDownloadSetup = useCallback(async () => {
    setIsDownloadingSetup(true)
    try {
      const artifact = await downloadSetupScript(session.token)
      saveBlobAsFile(artifact.blob, artifact.filename)
      setNotice({
        severity: 'success',
        message:
          'install-generator.exe downloaded. Run it on the target machine to register, build, and install Inventory.',
      })
    } catch (requestError) {
      setNotice({ severity: 'error', message: getErrorMessage(requestError) })
    } finally {
      setIsDownloadingSetup(false)
    }
  }, [session.token])

  const hasUuids = !isLoadingRecords && uuidEntries.length > 0

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DashboardHeader
        user={session.user}
        onLogout={onLogout}
        showSetupButton={hasUuids}
        isDownloadingSetup={isDownloadingSetup}
        onDownloadSetup={handleDownloadSetup}
      />

      {/* ── Empty state: no machines registered yet ── */}
      {!isLoadingRecords && !hasUuids && (
        <Box
          sx={{
            minHeight: 'calc(100vh - 64px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: 3,
          }}
        >
          <Paper
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 3,
              p: { xs: 4, md: 6 },
              maxWidth: 520,
              width: '100%',
              textAlign: 'center',
            }}
          >
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 3,
              }}
            >
              <MonitorIcon sx={{ fontSize: 36, color: 'primary.contrastText' }} />
            </Box>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Register your first machine
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              Download the setup program and run it on each Windows machine you want to
              manage. It detects the machine’s UUID and registers it here automatically.
              Then come back to download and install the app.
            </Typography>
            <Button
              variant="contained"
              size="large"
              startIcon={
                isDownloadingSetup ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <DownloadIcon />
                )
              }
              disabled={isDownloadingSetup}
              onClick={handleDownloadSetup}
              sx={{ minWidth: 240 }}
            >
              {isDownloadingSetup ? 'Preparing…' : 'Download install‑generator.exe'}
            </Button>
            <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 2 }}>
              Windows only · requires .NET Framework 4.x (built into Windows 10+)
            </Typography>
          </Paper>
        </Box>
      )}

      {/* ── Main dashboard (shown once machines / builds exist) ── */}
      {hasUuids && (
      <Box
        component="main"
        sx={{
          width: '100%',
          maxWidth: 1400,
          mx: 'auto',
          px: { xs: 2, md: 3 },
          py: { xs: 3, md: 4 },
        }}
      >
        <Stack spacing={3}>
          <Typography variant="h4">Build Dashboard</Typography>

          {(uuidEntries.length === 0 || isAddingUuid) && (
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <Box sx={{ flex: 1 }}>
                <GenerateBuildForm isBuildActive={Boolean(activeUuid)} onGenerate={handleGenerateBuild} />
              </Box>
              {isAddingUuid && (
                <Tooltip title="Cancel">
                  <IconButton onClick={() => setIsAddingUuid(false)}>
                    <CloseIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          )}

          <BuildSummaryCards records={records} />

          <Box
            sx={{
              display: 'grid',
              gap: 2.5,
              gridTemplateColumns: { xs: '1fr', lg: '340px 1fr' },
              alignItems: 'start',
            }}
          >
            <UuidListPanel
              entries={uuidEntries}
              selectedUuid={selectedUuid}
              isLoading={isLoadingRecords}
              error={recordsError}
              onSelect={setSelectedUuid}
              onRefresh={loadRecords}
              onAddUuid={uuidEntries.length > 0 ? () => setIsAddingUuid(true) : undefined}
            />

            {selectedUuid ? (
              <UuidDetailPanel
                uuid={selectedUuid}
                records={selectedRecords}
                streamEvents={streamEvents}
                streamUuid={streamUuid}
                activeUuid={activeUuid}
                downloadingUuid={downloadingUuid}
                deletingId={deletingId}
                isLoadingRecords={isLoadingRecords}
                onGenerate={handleGenerateBuild}
                onDownload={handleDownloadBuild}
                onDelete={handleDeleteBuild}
              />
            ) : (
              <Paper
                elevation={0}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  p: { xs: 3, md: 6 },
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography color="text.secondary">
                  Select a UUID from the list to view its build details.
                </Typography>
              </Paper>
            )}
          </Box>
        </Stack>
      </Box>)}
      <DashboardSnackbar notice={notice} onClose={handleDismissNotice} />
    </Box>
  )
}