import type { AuthTokenResponse, LoginPayload, RegisterPayload } from '../types'
import { requestJson } from './http'

export function login(payload: LoginPayload) {
  return requestJson<AuthTokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function register(payload: RegisterPayload) {
  return requestJson<AuthTokenResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}