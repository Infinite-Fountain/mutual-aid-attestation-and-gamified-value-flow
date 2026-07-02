/**
 * Stateless base64url codec for Telegram startapp tokens.
 * Encodes internal paths like `/mobile/attest?projectId=...`
 */

function toBase64(bytes: string): string {
  if (typeof btoa !== 'undefined') {
    return btoa(bytes)
  }
  return Buffer.from(bytes, 'utf-8').toString('base64')
}

function fromBase64(b64: string): string {
  if (typeof atob !== 'undefined') {
    return atob(b64)
  }
  return Buffer.from(b64, 'base64').toString('utf-8')
}

export function encodePathToToken(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return toBase64(normalized).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodePathFromToken(token: string): string {
  let b64 = token.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4
  if (pad) {
    b64 += '='.repeat(4 - pad)
  }
  const path = fromBase64(b64)
  if (!path.startsWith('/')) {
    throw new Error('Decoded path must start with /')
  }
  return path
}
