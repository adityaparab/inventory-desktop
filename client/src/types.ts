export type AuthMode = 'login' | 'register'

export interface AuthTokenResponse {
  accessToken: string
}

export interface LoginPayload {
  usernameOrEmail: string
  password: string
}

export interface RegisterPayload {
  fullName: string
  username: string
  email: string
  password: string
}

export interface AuthUser {
  userId: string
  username: string
  email: string
}

export interface AuthSession {
  token: string
  user: AuthUser
}

export type BuildStatus = 'building' | 'completed' | 'failed'

export interface BuildRecord {
  id: string
  uuid: string
  machineName: string | null
  status: BuildStatus
  outputFilename: string | null
  createdAt: string | null
  completedAt: string | null
  canDownload: boolean
}

export type BuildStreamEventType = 'log' | 'stderr' | 'complete' | 'error'

export interface BuildStreamEvent {
  type: BuildStreamEventType
  message: string
}

export interface DownloadedArtifact {
  blob: Blob
  filename: string
}

export interface DashboardNotice {
  severity: 'success' | 'info' | 'warning' | 'error'
  message: string
}