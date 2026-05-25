import type { BuildRecord, BuildStreamEvent, DownloadedArtifact } from '../types'
import { apiUrl, createApiError, requestJson } from './http'

const DEFAULT_DOWNLOAD_FILENAME = 'inventory_setup.exe'

interface StreamBuildHandlers {
  onEvent: (event: BuildStreamEvent) => void
}

export function listBuilds(token: string) {
  return requestJson<BuildRecord[]>('/builds', { token })
}

export async function deleteBuild(id: string, token: string): Promise<void> {
  const response = await fetch(apiUrl(`/builds/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw await createApiError(response)
  }
}

export async function downloadBuild(uuid: string, token: string): Promise<DownloadedArtifact> {
  const response = await fetch(apiUrl(`/download/${encodeURIComponent(uuid)}`), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw await createApiError(response)
  }

  return {
    blob: await response.blob(),
    filename: parseDownloadFilename(response.headers.get('content-disposition')),
  }
}

export async function streamBuild(
  uuid: string,
  token: string,
  handlers: StreamBuildHandlers,
) {
  const response = await fetch(apiUrl(`/generate/${encodeURIComponent(uuid)}`), {
    headers: {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw await createApiError(response)
  }

  if (!response.body) {
    throw new Error('The build stream could not be opened.')
  }

  await readServerSentEvents(response.body, handlers.onEvent)
}

async function readServerSentEvents(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: BuildStreamEvent) => void,
) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const result = await reader.read()

    if (result.done) {
      emitBufferedEvent(buffer, onEvent)
      return
    }

    buffer += decoder.decode(result.value, { stream: true })
    const chunks = buffer.split(/\r?\n\r?\n/)
    buffer = chunks.pop() ?? ''

    chunks.forEach((chunk) => emitBufferedEvent(chunk, onEvent))
  }
}

function emitBufferedEvent(rawEvent: string, onEvent: (event: BuildStreamEvent) => void) {
  const data = rawEvent
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')

  if (!data) {
    return
  }

  const event = parseStreamEvent(data)

  if (event) {
    onEvent(event)
  }
}

function parseStreamEvent(data: string): BuildStreamEvent | null {
  try {
    const payload = JSON.parse(data)
    const candidate = payload.data && typeof payload.data === 'object' ? payload.data : payload

    if (typeof candidate.type === 'string' && typeof candidate.message === 'string') {
      return {
        type: candidate.type,
        message: candidate.message,
      }
    }
  } catch {
    return null
  }

  return null
}

function parseDownloadFilename(contentDisposition: string | null) {
  const filename = contentDisposition?.match(/filename="?([^";]+)"?/i)?.[1]
  return filename ? decodeURIComponent(filename) : DEFAULT_DOWNLOAD_FILENAME
}