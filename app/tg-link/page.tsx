'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  generateDeepLink,
  normalizeInternalPath,
  type LinkPlatform,
} from '../core/links/linkFactory'
import { decodePathFromToken, encodePathToToken } from '../core/links/base64url'

const PILOT_PATH =
  '/mobile/attest?projectId=karma-testing&folderId=agroforestdao-test&snapshotId=20260109-043334-m1yga1&milestoneIndex=0&signal=telegram'

async function copyText(text: string) {
  await navigator.clipboard.writeText(text)
}

export default function TgLinkPage() {
  const [internalPath, setInternalPath] = useState(PILOT_PATH)
  const [platform, setPlatform] = useState<LinkPlatform>('telegram')
  const [copied, setCopied] = useState<string | null>(null)

  const normalizedPath = useMemo(() => {
    try {
      return normalizeInternalPath(internalPath)
    } catch {
      return null
    }
  }, [internalPath])

  const telegramLink = normalizedPath ? generateDeepLink('telegram', normalizedPath) : null
  const [browserLink, setBrowserLink] = useState<string | null>(null)

  useEffect(() => {
    if (!normalizedPath) {
      setBrowserLink(null)
      return
    }
    setBrowserLink(`${window.location.origin}${normalizedPath}`)
  }, [normalizedPath])

  const productionBrowserLink = normalizedPath
    ? generateDeepLink('browser', normalizedPath)
    : null
  const token = normalizedPath ? encodePathToToken(normalizedPath) : null
  const roundTripPath = token
    ? (() => {
        try {
          return decodePathFromToken(token)
        } catch {
          return null
        }
      })()
    : null

  const roundTripOk = normalizedPath && roundTripPath === normalizedPath

  const handleCopy = async (label: string, text: string) => {
    await copyText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-4 pb-12 max-w-2xl mx-auto">
      <header className="mb-6 pt-4">
        <h1 className="text-xl font-semibold">Link converter</h1>
        <p className="text-sm text-slate-400 mt-1">
          Paste an internal path after a freeze. Copy the Telegram or browser link for 1:1 handoff.
        </p>
      </header>

      <section className="mb-6">
        <label htmlFor="path" className="block text-sm font-medium text-slate-300 mb-2">
          Internal path
        </label>
        <textarea
          id="path"
          rows={4}
          value={internalPath}
          onChange={(e) => setInternalPath(e.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-mono text-white resize-y focus:border-sky-500 focus:outline-none"
          placeholder="/mobile/attest?projectId=...&folderId=...&snapshotId=...&milestoneIndex=0"
        />
        {normalizedPath && (
          <p className="text-xs text-slate-500 mt-2 font-mono break-all">Normalized: {normalizedPath}</p>
        )}
      </section>

      <section className="mb-6 flex flex-wrap gap-2">
        {(['telegram', 'browser', 'worldapp', 'minipay'] as const).map((p) => (
          <button
            key={p}
            type="button"
            disabled={p === 'worldapp' || p === 'minipay'}
            onClick={() => setPlatform(p)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize border ${
              p === 'worldapp' || p === 'minipay'
                ? 'border-slate-800 text-slate-600 cursor-not-allowed'
                : platform === p
                  ? 'border-sky-500 bg-sky-950 text-sky-200'
                  : 'border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            {p === 'worldapp' || p === 'minipay' ? `${p} (coming soon)` : p}
          </button>
        ))}
      </section>

      {telegramLink && (
        <section className="mb-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-sm font-medium text-sky-400 mb-2">Telegram (routing)</h2>
          <p className="text-xs font-mono break-all text-slate-300 mb-3">{telegramLink}</p>
          <button
            type="button"
            onClick={() => handleCopy('telegram', telegramLink)}
            className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm"
          >
            {copied === 'telegram' ? 'Copied!' : 'Copy t.me link'}
          </button>
        </section>
      )}

      {browserLink && (
        <section className="mb-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-sm font-medium text-emerald-400 mb-2">Browser (MetaMask attest)</h2>
          <p className="text-xs font-mono break-all text-slate-300 mb-3">{browserLink}</p>
          <button
            type="button"
            onClick={() => handleCopy('browser', browserLink)}
            className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm"
          >
            {copied === 'browser' ? 'Copied!' : 'Copy https link'}
          </button>
          {productionBrowserLink && productionBrowserLink !== browserLink && (
            <p className="text-xs text-slate-500 mt-3">
              Production handoff:{' '}
              <span className="font-mono text-slate-400 break-all">{productionBrowserLink}</span>
            </p>
          )}
        </section>
      )}

      {token && (
        <section className="mb-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="text-sm font-medium text-slate-400 mb-2">Round-trip check</h2>
          <p className="text-xs text-slate-500 mb-1">startapp token:</p>
          <p className="text-xs font-mono break-all text-slate-400 mb-3">{token}</p>
          <p className={`text-sm ${roundTripOk ? 'text-emerald-400' : 'text-red-400'}`}>
            {roundTripOk ? 'Decode matches input (folderId preserved)' : 'Decode mismatch — fix codec'}
          </p>
          <p className="text-xs text-slate-500 mt-3">
            Desktop boot test:{' '}
            <span className="font-mono text-slate-400">/?startapp={token}</span>
          </p>
        </section>
      )}
    </main>
  )
}
