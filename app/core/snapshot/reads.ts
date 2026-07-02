import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { db } from '../firebase/client'
import type { AttestRouteParams, MilestoneData, SnapshotManifest } from '../types'

function snapshotBasePath(projectId: string, folderId: string, snapshotId: string) {
  return `newsroom/${projectId}/folders/${folderId}/snapshots/${snapshotId}`
}

export async function loadSnapshotManifest(
  projectId: string,
  folderId: string,
  snapshotId: string
): Promise<SnapshotManifest> {
  const manifestRef = doc(db, snapshotBasePath(projectId, folderId, snapshotId))
  const manifestSnap = await getDoc(manifestRef)

  if (!manifestSnap.exists()) {
    throw new Error('Snapshot manifest not found')
  }

  const data = manifestSnap.data()
  const icfHash = data.icfHash || ''
  const icfUrl = data.icfUrl || ''

  if (!icfHash || !icfUrl) {
    throw new Error('Immutable content hash or URL not found in snapshot manifest')
  }

  return { icfHash, icfUrl, name: data.name }
}

async function findGeneralTableBlockId(
  projectId: string,
  folderId: string,
  snapshotId: string
): Promise<string | null> {
  const blocksRef = collection(db, `${snapshotBasePath(projectId, folderId, snapshotId)}/blocks`)
  const blocksSnap = await getDocs(blocksRef)

  let blockId: string | null = null
  blocksSnap.forEach((docSnap) => {
    const blockData = docSnap.data()
    if (blockData['block-type'] === 'karma-report' && blockData['karma-subtype'] === 'karma-general-table') {
      blockId = docSnap.id
    }
  })

  return blockId
}

export async function loadMilestoneByIndex(
  params: AttestRouteParams
): Promise<MilestoneData> {
  const { projectId, folderId, snapshotId, milestoneIndex } = params
  const generalTableBlockId = await findGeneralTableBlockId(projectId, folderId, snapshotId)

  if (!generalTableBlockId) {
    throw new Error('General table block not found in snapshot')
  }

  const tableDataPath = `${snapshotBasePath(projectId, folderId, snapshotId)}/blocks/${generalTableBlockId}/table-data/karma-general-table`
  const tableDataRef = doc(db, tableDataPath)
  const tableDataSnap = await getDoc(tableDataRef)

  if (!tableDataSnap.exists()) {
    throw new Error('General table data not found')
  }

  const rows = tableDataSnap.data().rows || []

  if (milestoneIndex < 0 || milestoneIndex >= rows.length) {
    throw new Error(`Milestone index ${milestoneIndex} out of range (${rows.length} rows)`)
  }

  const row = rows[milestoneIndex]
  return {
    officialDate: row.officialDate || '',
    summary: row.summary,
    notes: row.notes,
    proofs: row.proofs,
    images: row.images,
  }
}
