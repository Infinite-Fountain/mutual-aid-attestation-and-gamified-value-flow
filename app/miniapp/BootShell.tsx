'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { resolveBootPath } from '../core/links/linkFactory'
import { formatRouterPath } from '../core/links/formatRouterPath'
import {
  getTelegramStartParam,
  getTelegramWebApp,
  isTelegramMiniApp,
} from './adapters/telegram'

function resolveStartToken(searchParams: URLSearchParams): string | null {
  return (
    searchParams.get('startapp') ||
    searchParams.get('tgWebAppStartParam') ||
    getTelegramStartParam()
  )
}

function isBootEntryPath(pathname: string): boolean {
  return pathname === '/' || pathname === '' || pathname === '/index.html'
}

function BootWaitingScreen() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="h-8 w-8 border-2 border-slate-600 border-t-sky-400 rounded-full animate-spin" />
      <p className="text-sm text-slate-300">Opening milestone…</p>
    </div>
  )
}

function navigateToBootTarget(path: string, router: ReturnType<typeof useRouter>) {
  const formatted = formatRouterPath(path)

  if (typeof window !== 'undefined' && isTelegramMiniApp()) {
    const target = formatted.startsWith('http')
      ? formatted
      : `${window.location.origin}${formatted}`
    window.location.replace(target)
    return
  }

  router.replace(formatted)
}

function BootShellInner({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const didRedirect = useRef(false)
  const [holdBootScreen, setHoldBootScreen] = useState(false)

  useEffect(() => {
    if (!isBootEntryPath(pathname)) {
      setHoldBootScreen(false)
      return
    }

    const hasUrlToken =
      searchParams.has('startapp') || searchParams.has('tgWebAppStartParam')
    const hasTelegramStartParam = Boolean(getTelegramStartParam())
    const shouldWait = hasUrlToken || hasTelegramStartParam || isTelegramMiniApp()

    if (!shouldWait) {
      setHoldBootScreen(false)
      return
    }

    setHoldBootScreen(true)

    function attemptRedirect(): boolean {
      if (didRedirect.current) return true
      const token = resolveStartToken(searchParams)
      if (!token) return false

      try {
        const path = resolveBootPath(token)
        didRedirect.current = true
        setHoldBootScreen(false)
        navigateToBootTarget(path, router)
        return true
      } catch (err) {
        console.error('[BootShell] Failed to decode startapp token:', err)
        return false
      }
    }

    const tg = getTelegramWebApp()
    if (tg) {
      tg.ready()
      tg.expand?.()
    }

    if (attemptRedirect()) return

    const poll = setInterval(() => {
      if (attemptRedirect()) {
        clearInterval(poll)
      }
    }, 100)

    const giveUp = setTimeout(() => {
      clearInterval(poll)
      setHoldBootScreen(false)
    }, 6000)

    return () => {
      clearInterval(poll)
      clearTimeout(giveUp)
    }
  }, [pathname, searchParams, router])

  if (holdBootScreen && isBootEntryPath(pathname) && !didRedirect.current) {
    return <BootWaitingScreen />
  }

  return <>{children}</>
}

export function BootShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={children}>
      <BootShellInner>{children}</BootShellInner>
    </Suspense>
  )
}
