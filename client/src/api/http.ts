const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

interface RequestOptions extends RequestInit {
  token?: string
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }
  return 'Something went wrong. Please try again.'
}

export async function createApiError(response: Response) {
  const fallbackMessage = `${response.status} ${response.statusText}`.trim()

  try {
    const payload = await response.clone().json()
    const message = Array.isArray(payload.message)
      ? payload.message.join(' ')
      : payload.message

    return new ApiError(message || fallbackMessage, response.status)
  } catch {
    const message = await response.text()
    return new ApiError(message || fallbackMessage, response.status)
  }
}

export async function requestJson<ResponseBody>(
  path: string,
  options: RequestOptions = {},
) {
  const headers = new Headers(options.headers)

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`)
  }

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(apiUrl(path), {
    ...options,
    headers,
  })

  if (!response.ok) {
    throw await createApiError(response)
  }

  if (response.status === 204) {
    return undefined as ResponseBody
  }

  return response.json() as Promise<ResponseBody>
}