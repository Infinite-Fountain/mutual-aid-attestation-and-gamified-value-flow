import { ethers } from 'ethers'
import { EAS, SchemaEncoder } from '@ethereum-attestation-service/eas-sdk'
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase/client'
import { normalizeWalletAddress } from '../allowlist/members'
import { EAS_CONTRACT_ADDRESS } from './constants'
import { EAS_SCHEMA_UIDS, getAttestationExplorerUrl } from './schemas'
import type { AttestationType, AttestRouteParams, MilestoneData } from '../types'
import { loadSnapshotManifest } from '../snapshot/reads'

export interface SubmitAttestationInput {
  params: AttestRouteParams
  milestone: MilestoneData
  score: number
  comment: string
  attestationType?: AttestationType
  walletAddress: string
  signer: ethers.Signer
  attesterDisplayName?: string
  existingAttestationDocId?: string | null
}

export interface SubmitAttestationResult {
  attestationUID: string
  attestationDocId: string
  easExplorerUrl: string
  milestoneIndex: number
}

function normalizeIcfHash(icfHash: string): string {
  let hashHex = icfHash.replace(/^0x/, '').toLowerCase()
  if (!/^[0-9a-f]+$/.test(hashHex)) {
    throw new Error('Invalid hex string in icfHash')
  }
  if (hashHex.length > 64) {
    hashHex = hashHex.substring(0, 64)
  } else if (hashHex.length < 64) {
    hashHex = hashHex.padEnd(64, '0')
  }
  return ethers.hexlify('0x' + hashHex)
}

export async function findExistingAttestation(
  params: AttestRouteParams,
  walletAddress: string,
  attestationType: AttestationType = 'outcomes'
): Promise<{ docId: string; data: Record<string, unknown> } | null> {
  const { projectId, folderId, snapshotId, milestoneIndex } = params
  const attestationsPath = `newsroom/${projectId}/folders/${folderId}/snapshots/${snapshotId}/attestations`
  const attestationTypeKey = attestationType === 'outcomes' ? 'milestone-outcomes' : 'milestone-reporting'
  const normalizedWallet = normalizeWalletAddress(walletAddress)

  const existingQuery = query(
    collection(db, attestationsPath),
    where('type', '==', 'attestation'),
    where('attestationType', '==', attestationTypeKey),
    where('milestoneIndex', '==', milestoneIndex),
    where('attesterSmartWallet', '==', normalizedWallet),
    where('isActive', '==', true)
  )

  const existing = await getDocs(existingQuery)
  if (existing.empty) return null

  const existingDoc = existing.docs[0]
  return { docId: existingDoc.id, data: existingDoc.data() }
}

export async function submitMilestoneAttestation(
  input: SubmitAttestationInput
): Promise<SubmitAttestationResult> {
  const {
    params,
    milestone,
    score,
    comment,
    attestationType = 'outcomes',
    walletAddress,
    signer,
    attesterDisplayName,
    existingAttestationDocId = null,
  } = input

  const { projectId, folderId, snapshotId, milestoneIndex } = params
  const manifest = await loadSnapshotManifest(projectId, folderId, snapshotId)
  const icfHash = normalizeIcfHash(manifest.icfHash)
  const icfUrl = manifest.icfUrl
  const milestoneSummary = milestone.summary ? milestone.summary.substring(0, 600) : ''
  const discussionId = ''
  const normalizedWallet = normalizeWalletAddress(walletAddress)

  const eas = new EAS(EAS_CONTRACT_ADDRESS)
  eas.connect(signer)

  const isReporting = attestationType === 'reporting'
  const schemaString = isReporting
    ? 'uint8 scoreReporting,string comment,string milestoneSummary,string projectId,string folderId,string snapshotId,uint16 milestoneIndex,string discussionId,bytes32 ImmutableContentHash,string ImmutableContentUrl'
    : 'uint8 scoreOutcomes,string comment,string milestoneSummary,string projectId,string folderId,string snapshotId,uint16 milestoneIndex,string discussionId,bytes32 ImmutableContentHash,string ImmutableContentUrl'

  const easScoreFieldName = isReporting ? 'scoreReporting' : 'scoreOutcomes'
  const schemaUID = isReporting ? EAS_SCHEMA_UIDS.MILESTONE_REPORTING : EAS_SCHEMA_UIDS.MILESTONE_OUTCOMES

  const schemaEncoder = new SchemaEncoder(schemaString)
  const encodedData = schemaEncoder.encodeData([
    { name: easScoreFieldName, value: score, type: 'uint8' },
    { name: 'comment', value: comment || '', type: 'string' },
    { name: 'milestoneSummary', value: milestoneSummary, type: 'string' },
    { name: 'projectId', value: projectId, type: 'string' },
    { name: 'folderId', value: folderId, type: 'string' },
    { name: 'snapshotId', value: snapshotId, type: 'string' },
    { name: 'milestoneIndex', value: milestoneIndex, type: 'uint16' },
    { name: 'discussionId', value: discussionId, type: 'string' },
    { name: 'ImmutableContentHash', value: icfHash, type: 'bytes32' },
    { name: 'ImmutableContentUrl', value: icfUrl, type: 'string' },
  ])

  const tx = await eas.attest({
    schema: schemaUID,
    data: {
      recipient: '0x0000000000000000000000000000000000000000',
      revocable: true,
      data: encodedData,
    },
  })

  const attestationUID = await tx.wait()
  const displayName =
    attesterDisplayName ||
    `${normalizedWallet.substring(0, 6)}…${normalizedWallet.substring(normalizedWallet.length - 4)}`

  const attestationDocId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  const attestationPath = `newsroom/${projectId}/folders/${folderId}/snapshots/${snapshotId}/attestations/${attestationDocId}`

  let cleanedImages: Record<string, string> | undefined
  if (milestone.images) {
    cleanedImages = {}
    if (milestone.images.main) cleanedImages.main = milestone.images.main
    if (milestone.images.image2) cleanedImages.image2 = milestone.images.image2
    if (milestone.images.image3) cleanedImages.image3 = milestone.images.image3
    if (Object.keys(cleanedImages).length === 0) cleanedImages = undefined
  }

  const attestationTypeKey = isReporting ? 'milestone-reporting' : 'milestone-outcomes'
  const scoreFieldName = isReporting ? 'attestationReportingScore' : 'attestationOutcomesScore'

  await setDoc(doc(db, attestationPath), {
    type: 'attestation',
    attestationType: attestationTypeKey,
    projectId,
    folderId,
    snapshotId,
    milestoneIndex,
    ImmutableContentHash: icfHash,
    milestoneSummary,
    milestoneOfficialDate: milestone.officialDate || '',
    notes: milestone.notes || '',
    proofs: milestone.proofs || [],
    ...(cleanedImages && { images: cleanedImages }),
    [scoreFieldName]: score,
    attestationComment: comment || '',
    attesterSmartWallet: normalizedWallet,
    attesterPrivyId: '',
    attesterExtraInfo: displayName,
    ImmutableContentUrl: icfUrl,
    discussionId,
    attestationEasUID: attestationUID,
    easExplorerUrl: getAttestationExplorerUrl(attestationUID),
    easSchemaUID: schemaUID,
    revocable: true,
    revoked: false,
    revokedAt: null,
    revokedBy: null,
    replacedBy: null,
    replaces: existingAttestationDocId,
    isActive: true,
    createdAt: serverTimestamp(),
  })

  if (existingAttestationDocId) {
    const oldPath = `newsroom/${projectId}/folders/${folderId}/snapshots/${snapshotId}/attestations/${existingAttestationDocId}`
    await updateDoc(doc(db, oldPath), {
      isActive: false,
      replacedBy: attestationDocId,
    })
  }

  return {
    attestationUID,
    attestationDocId,
    easExplorerUrl: getAttestationExplorerUrl(attestationUID),
    milestoneIndex,
  }
}
