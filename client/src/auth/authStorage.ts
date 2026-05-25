const AUTH_TOKEN_KEY = 'inventory-build-console-token'

export function loadStoredToken() {
  return window.localStorage.getItem(AUTH_TOKEN_KEY)
}

export function storeToken(token: string) {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearStoredToken() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY)
}