import { useCallback, useMemo, useState } from 'react'
import { clearStoredToken, loadStoredToken, storeToken } from '../auth/authStorage'
import { decodeAuthToken } from '../auth/jwt'
import type { AuthSession } from '../types'

export function useAuthSession() {
  const [token, setToken] = useState(() => loadValidStoredToken())
  const user = useMemo(() => (token ? decodeAuthToken(token) : null), [token])

  const signIn = useCallback((accessToken: string) => {
    storeToken(accessToken)
    setToken(accessToken)
  }, [])

  const signOut = useCallback(() => {
    clearStoredToken()
    setToken(null)
  }, [])

  const session = useMemo<AuthSession | null>(() => {
    if (!token || !user) {
      return null
    }

    return { token, user }
  }, [token, user])

  return { session, signIn, signOut }
}

function loadValidStoredToken() {
  const storedToken = loadStoredToken()

  if (!storedToken) {
    return null
  }

  if (!decodeAuthToken(storedToken)) {
    clearStoredToken()
    return null
  }

  return storedToken
}