'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { MobileAttestCard } from './MobileAttestCard'

function MobileAttestContent() {
  const searchParams = useSearchParams()

  const projectId = searchParams.get('projectId')
  const folderId = searchParams.get('folderId')
  const snapshotId = searchParams.get('snapshotId')
  const milestoneIndexRaw = searchParams.get('milestoneIndex')

  if (!projectId || !folderId || !snapshotId || milestoneIndexRaw === null) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold">Attest to a milestone</h1>
          <p className="text-sm text-slate-400">
            Open a link from your moderator with projectId, folderId, snapshotId, and milestoneIndex.
          </p>
          <p className="text-xs text-slate-500 font-mono break-all">
            /mobile/attest?projectId=...&folderId=...&snapshotId=...&milestoneIndex=0
          </p>
        </div>
      </main>
    )
  }

  const milestoneIndex = parseInt(milestoneIndexRaw, 10)
  if (Number.isNaN(milestoneIndex) || milestoneIndex < 0) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-red-400">Invalid milestoneIndex</p>
      </main>
    )
  }

  return (
    <MobileAttestCard
      projectId={projectId}
      folderId={folderId}
      snapshotId={snapshotId}
      milestoneIndex={milestoneIndex}
    />
  )
}

export default function MobileAttestPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <div className="animate-spin h-8 w-8 border-2 border-slate-600 border-t-sky-400 rounded-full" />
        </main>
      }
    >
      <MobileAttestContent />
    </Suspense>
  )
}
