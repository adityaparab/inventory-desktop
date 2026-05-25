import type { DownloadedArtifact } from '../types'
import { apiUrl, createApiError } from './http'

/**
 * Downloads the personalised machine setup executable for the authenticated
 * user. The returned EXE embeds a single-use token and the server URL so the
 * end-user just runs it without any manual config.
 */
export async function downloadSetupScript(token: string): Promise<DownloadedArtifact> {
  const response = await fetch(apiUrl('/setup/download'), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw await createApiError(response)
  }

  return {
    blob: await response.blob(),
    filename: 'install-generator.exe',
  }
}
