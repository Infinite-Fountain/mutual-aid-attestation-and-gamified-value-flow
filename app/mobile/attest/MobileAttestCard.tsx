'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ethers } from 'ethers'
import ConnectWalletButton from '../../interoperable-canvas/components/ConnectWalletButton'
import { checkMemberCanAttest } from '../../core/allowlist/members'
import {
  findExistingAttestation,
  submitMilestoneAttestation,
} from '../../core/eas/submitMilestoneAttestation'
import { updateNodeHistogramDelta } from '../../core/histogram/updateNodeHistogram'
import { formatRouterPath } from '../../core/links/formatRouterPath'
import { loadMilestoneByIndex, loadSnapshotManifest } from '../../core/snapshot/reads'
import { switchWalletToBase } from '../../core/wallet/switchToBase'
import type { MilestoneData } from '../../core/types'
import {
  getTelegramUser,
  isTelegramMiniApp,
  openExternalBrowserLink,
  telegramDisplayName,
} from '../../miniapp/adapters/telegram'

type Props = {
  projectId: string
  folderId: string
  snapshotId: string
  milestoneIndex: number
}

type LoadState = 'loading' | 'ready' | 'error'

export function MobileAttestCard({ projectId, folderId, snapshotId, milestoneIndex }: Props) {
  const inTelegram = isTelegramMiniApp()
  const tgUser = getTelegramUser()
  const tgName = telegramDisplayName(tgUser)

  const [account, setAccount] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [milestone, setMilestone] = useState<MilestoneData | null>(null)
  const [snapshotName, setSnapshotName] = useState<string | null>(null)

  const [authState, setAuthState] = useState<'checking' | 'authorized' | 'denied'>('checking')
  const [score, setScore] = useState('')
  const [comment, setComment] = useState('')
  const [status, setStatus] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState<{
    attestationUID: string
    easExplorerUrl: string
  } | null>(null)
  const [existingDocId, setExistingDocId] = useState<string | null>(null)

  const routeParams = useMemo(
    () => ({ projectId, folderId, snapshotId, milestoneIndex }),
    [projectId, folderId, snapshotId, milestoneIndex]
  )

  const browserAttestPath = useMemo(() => {
    const qs = new URLSearchParams({
      projectId,
      folderId,
      snapshotId,
      milestoneIndex: String(milestoneIndex),
    })
    return formatRouterPath(`/mobile/attest?${qs.toString()}`)
  }, [projectId, folderId, snapshotId, milestoneIndex])

  const browserAttestUrl = useMemo(() => {
    if (typeof window === 'undefined') return null
    return `${window.location.origin}${browserAttestPath}`
  }, [browserAttestPath])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoadState('loading')
      setLoadError(null)
      try {
        const [milestoneData, manifest] = await Promise.all([
          loadMilestoneByIndex(routeParams),
          loadSnapshotManifest(projectId, folderId, snapshotId),
        ])
        if (cancelled) return
        setMilestone(milestoneData)
        setSnapshotName(manifest.name || snapshotId)
        setLoadState('ready')
      } catch (err) {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : 'Failed to load milestone')
        setLoadState('error')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [routeParams, projectId, folderId, snapshotId])

  useEffect(() => {
    if (inTelegram) return

    const ethereum = (window as Window & { ethereum?: { on?: (...args: unknown[]) => void; removeListener?: (...args: unknown[]) => void } }).ethereum
    if (!ethereum) return

    const syncAccount = async () => {
      try {
        const provider = new ethers.BrowserProvider(ethereum as ethers.Eip1193Provider)
        const accounts = await provider.listAccounts()
        setAccount(accounts.length > 0 ? accounts[0].address : null)
      } catch {
        setAccount(null)
      }
    }

    const onAccountsChanged = (accs: string[]) => {
      setAccount(accs?.[0] ?? null)
    }

    void syncAccount()
    ethereum.on?.('accountsChanged', onAccountsChanged)

    return () => {
      ethereum.removeListener?.('accountsChanged', onAccountsChanged)
    }
  }, [inTelegram])

  useEffect(() => {
    if (inTelegram || !account) {
      setAuthState('checking')
      return
    }

    let cancelled = false

    async function checkAuth() {
      const { authorized } = await checkMemberCanAttest(projectId, account!)
      if (cancelled) return
      setAuthState(authorized ? 'authorized' : 'denied')
    }

    checkAuth()
    return () => {
      cancelled = true
    }
  }, [inTelegram, account, projectId])

  useEffect(() => {
    if (inTelegram || !account || authState !== 'authorized') return

    let cancelled = false

    async function checkExisting() {
      const existing = await findExistingAttestation(routeParams, account!)
      if (cancelled || !existing) return

      setExistingDocId(existing.docId)
      const scoreVal = existing.data.attestationOutcomesScore
      if (typeof scoreVal === 'number') setScore(String(scoreVal))
      if (typeof existing.data.attestationComment === 'string') {
        setComment(existing.data.attestationComment)
      }
    }

    checkExisting()
    return () => {
      cancelled = true
    }
  }, [inTelegram, account, authState, routeParams])

  const handleSubmit = useCallback(async () => {
    if (!account || !milestone) return

    const scoreNum = parseInt(score, 10)
    if (Number.isNaN(scoreNum) || scoreNum < 1 || scoreNum > 100) {
      setStatus('Score must be between 1 and 100')
      return
    }

    setIsSubmitting(true)
    setStatus('Switching to Base and creating attestation…')

    try {
      await switchWalletToBase()
      const anyWindow = window as Window & { ethereum?: ethers.Eip1193Provider }
      if (!anyWindow.ethereum) {
        throw new Error('Wallet not found')
      }
      const provider = new ethers.BrowserProvider(anyWindow.ethereum)
      const signer = await provider.getSigner()
      const walletAddress = await signer.getAddress()

      const result = await submitMilestoneAttestation({
        params: routeParams,
        milestone,
        score: scoreNum,
        comment,
        walletAddress,
        signer,
        existingAttestationDocId: existingDocId,
      })

      setStatus('Updating histogram…')
      await updateNodeHistogramDelta(projectId, folderId, snapshotId, milestoneIndex, scoreNum)

      setSuccess({
        attestationUID: result.attestationUID,
        easExplorerUrl: result.easExplorerUrl,
      })
      setStatus('')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Attestation failed')
    } finally {
      setIsSubmitting(false)
    }
  }, [
    account,
    milestone,
    score,
    comment,
    routeParams,
    existingDocId,
    projectId,
    folderId,
    snapshotId,
    milestoneIndex,
  ])

  const summaryPreview = milestone?.summary
    ? milestone.summary.length > 280
      ? milestone.summary.slice(0, 280) + '…'
      : milestone.summary
    : 'No summary available'

  if (loadState === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin h-8 w-8 border-2 border-slate-600 border-t-sky-400 rounded-full mx-auto" />
          <p className="text-sm text-slate-400">Loading milestone…</p>
        </div>
      </main>
    )
  }

  if (loadState === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center space-y-2">
          <p className="text-red-400 font-medium">Could not load milestone</p>
          <p className="text-sm text-slate-400">{loadError}</p>
        </div>
      </main>
    )
  }

  if (success) {
    return (
      <main className="flex min-h-screen flex-col p-4 pb-8 max-w-lg mx-auto">
        <header className="mb-6 pt-2">
          <p className="text-xs uppercase tracking-wider text-sky-400">Attestation recorded</p>
          <h1 className="text-lg font-semibold mt-1">Thanks{account ? `, ${account.slice(0, 6)}…` : ''}</h1>
        </header>

        <div className="flex-1 space-y-4">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-5 text-center">
            <p className="text-emerald-300 text-sm mb-4">
              Your signal is on-chain. The cohort histogram for this node was updated.
            </p>
            <a
              href={success.easExplorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm transition-colors"
            >
              View on EAS Explorer
            </a>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col p-4 pb-8 max-w-lg mx-auto">
      <header className="mb-5 pt-2 border-b border-slate-800 pb-4">
        <p className="text-xs uppercase tracking-wider text-slate-500">Your attestation</p>
        <h1 className="text-lg font-semibold mt-1">
          {inTelegram ? tgName || 'Telegram member' : account ? `${account.slice(0, 6)}…${account.slice(-4)}` : 'Connect wallet'}
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          {snapshotName} · node {milestoneIndex}
          {milestone?.officialDate ? ` · ${milestone.officialDate}` : ''}
        </p>
      </header>

      <section className="mb-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
          Milestone summary
        </h2>
        <p className="text-sm text-slate-200 leading-relaxed">{summaryPreview}</p>
      </section>

      {inTelegram ? (
        <section className="flex-1 flex flex-col gap-4 py-4">
          <p className="text-sm text-slate-300">
            Telegram Mini App can route you here and show the milestone. To sign an on-chain EAS attestation,
            open this page in your mobile browser and connect MetaMask on Base.
          </p>
          {browserAttestUrl && (
            <button
              type="button"
              onClick={() => openExternalBrowserLink(browserAttestUrl)}
              className="w-full py-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-base transition-colors"
            >
              Open in browser to attest
            </button>
          )}
          <p className="text-xs text-slate-500 font-mono break-all">{browserAttestUrl}</p>
          {browserAttestUrl && (
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(browserAttestUrl)}
              className="text-xs text-sky-400 underline self-start"
            >
              Copy browser link
            </button>
          )}
        </section>
      ) : !account ? (
        <section className="flex-1 flex flex-col items-center justify-center gap-4 py-8">
          <p className="text-sm text-slate-400 text-center max-w-xs">
            Connect MetaMask on Base to attest. You pay gas for the EAS transaction.
          </p>
          <div className="w-full max-w-xs">
            <ConnectWalletButton />
          </div>
        </section>
      ) : authState === 'checking' ? (
        <section className="flex-1 flex items-center justify-center">
          <p className="text-sm text-slate-400">Checking membership…</p>
        </section>
      ) : authState === 'denied' ? (
        <section className="flex-1 flex flex-col items-center justify-center gap-3 py-8 text-center">
          <p className="text-amber-400 font-medium">Not on the attester list</p>
          <p className="text-sm text-slate-400 max-w-xs">
            Wallet <span className="font-mono text-slate-300">{account.slice(0, 10)}…</span> is not allowlisted
            for project <span className="font-mono text-slate-300">{projectId}</span>.
          </p>
        </section>
      ) : (
        <section className="flex-1 flex flex-col gap-4">
          {existingDocId && (
            <p className="text-xs text-amber-400/90 bg-amber-950/30 border border-amber-800/40 rounded-lg px-3 py-2">
              You already attested to this node. Submitting again replaces your prior signal.
            </p>
          )}

          <div>
            <label htmlFor="score" className="block text-sm font-medium text-slate-300 mb-2">
              Score (1–100)
            </label>
            <input
              id="score"
              type="number"
              min={1}
              max={100}
              inputMode="numeric"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-lg text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-50"
              placeholder="e.g. 85"
            />
          </div>

          <div>
            <label htmlFor="comment" className="block text-sm font-medium text-slate-300 mb-2">
              Comment (optional)
            </label>
            <textarea
              id="comment"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white resize-none focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-50"
              placeholder="Why this score?"
            />
          </div>

          {status && (
            <p
              className={`text-sm px-3 py-2 rounded-lg ${
                status.toLowerCase().includes('fail') || status.includes('must')
                  ? 'text-red-300 bg-red-950/40'
                  : 'text-sky-300 bg-sky-950/40'
              }`}
            >
              {status}
            </p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !score}
            className="mt-auto w-full py-4 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold text-base transition-colors"
          >
            {isSubmitting ? 'Submitting…' : existingDocId ? 'Update attestation' : 'Attest'}
          </button>
        </section>
      )}
    </main>
  )
}
