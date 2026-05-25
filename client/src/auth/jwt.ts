import type { AuthUser } from '../types'

interface JwtPayload {
  sub?: string
  username?: string
  email?: string
  exp?: number
}

export function decodeAuthToken(token: string): AuthUser | null {
  const payload = decodeJwtPayload(token)

  if (!payload?.sub || !payload.username || !payload.email) {
    return null
  }

  if (payload.exp && payload.exp * 1000 <= Date.now()) {
    return null
  }

  return {
    userId: payload.sub,
    username: payload.username,
    email: payload.email,
  }
}

function decodeJwtPayload(token: string): JwtPayload | null {
  const payload = token.split('.')[1]

  if (!payload) {
    return null
  }

  try {
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/')
    const paddedPayload = normalizedPayload.padEnd(
      Math.ceil(normalizedPayload.length / 4) * 4,
      '=',
    )
    const binaryPayload = window.atob(paddedPayload)
    const payloadBytes = Uint8Array.from(binaryPayload, (character) => character.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(payloadBytes)) as JwtPayload
  } catch {
    return null
  }
}