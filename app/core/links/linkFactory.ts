import { encodePathToToken, decodePathFromToken } from './base64url'

export type LinkPlatform = 'telegram' | 'browser' | 'worldapp' | 'minipay'

const TELEGRAM_BOT_USERNAME =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'infinite_fountain_bot'

export function normalizeInternalPath(path: string): string {
  const trimmed = path.trim()
  if (!trimmed) {
    throw new Error('Path is required')
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed)
      return `${url.pathname}${url.search}`
    } catch {
      throw new Error('Invalid URL')
    }
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

export function getSiteOrigin(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  }
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return ''
}

export function generateDeepLink(platform: LinkPlatform, internalPath: string): string | null {
  const path = normalizeInternalPath(internalPath)

  switch (platform) {
    case 'telegram': {
      const token = encodePathToToken(path)
      return `https://t.me/${TELEGRAM_BOT_USERNAME}?startapp=${token}&mode=fullscreen`
    }
    case 'browser': {
      const origin = getSiteOrigin()
      return origin ? `${origin}${path}` : null
    }
    case 'worldapp':
    case 'minipay':
      return null
    default:
      return null
  }
}

/** Decode a startapp token back to an internal path (boot shell + /tg-link verify). */
export function resolveBootPath(startParam: string): string {
  return decodePathFromToken(startParam)
}
