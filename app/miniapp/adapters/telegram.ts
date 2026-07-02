export type TelegramWebAppUser = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

export type TelegramWebApp = {
  ready: () => void
  expand?: () => void
  openLink?: (url: string) => void
  initData?: string
  initDataUnsafe?: {
    user?: TelegramWebAppUser
    start_param?: string
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null
  return (
    window as Window & { Telegram?: { WebApp?: TelegramWebApp } }
  ).Telegram?.WebApp ?? null
}

/** startapp token from t.me deep link — lives in initData, not always in the URL bar. */
export function getTelegramStartParam(): string | null {
  return getTelegramWebApp()?.initDataUnsafe?.start_param ?? null
}

export function isTelegramMiniApp(): boolean {
  if (typeof window === 'undefined') return false
  if (getTelegramWebApp()) return true
  return /Telegram/i.test(navigator.userAgent)
}

export function getTelegramUser(): TelegramWebAppUser | null {
  return getTelegramWebApp()?.initDataUnsafe?.user ?? null
}

export function telegramDisplayName(user: TelegramWebAppUser | null): string | null {
  if (!user) return null
  if (user.username) return `@${user.username}`
  const parts = [user.first_name, user.last_name].filter(Boolean)
  if (parts.length > 0) return parts.join(' ')
  return `Telegram ${user.id}`
}

/** Open URL in system browser (preferred for MetaMask attest backup path). */
export function openExternalBrowserLink(url: string): void {
  const tg = getTelegramWebApp()
  if (tg?.openLink) {
    tg.openLink(url)
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
