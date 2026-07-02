import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase/client'
import { HISTOGRAM_BINS, scoreToBinLabel } from './bins'

function histogramDocPath(
  projectId: string,
  folderId: string,
  snapshotId: string,
  milestoneIndex: number
) {
  return `newsroom/${projectId}/folders/${folderId}/snapshots/${snapshotId}/node-histograms/${milestoneIndex}`
}

export async function updateNodeHistogramDelta(
  projectId: string,
  folderId: string,
  snapshotId: string,
  milestoneIndex: number,
  score: number
): Promise<void> {
  const path = histogramDocPath(projectId, folderId, snapshotId, milestoneIndex)
  const histRef = doc(db, path)
  const existing = await getDoc(histRef)

  const binLabel = scoreToBinLabel(score)
  const emptyBins = Object.fromEntries(HISTOGRAM_BINS.map((b) => [b.label, 0]))

  if (existing.exists()) {
    const data = existing.data()
    const bins: Record<string, number> = { ...emptyBins, ...(data.bins || {}) }
    bins[binLabel] = (bins[binLabel] || 0) + 1
    const totalCount = (data.totalCount || 0) + 1
    const sumScores = (data.sumScores || 0) + score

    await setDoc(
      histRef,
      {
        milestoneIndex,
        bins,
        totalCount,
        sumScores,
        averageScore: Math.round(sumScores / totalCount),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    )
  } else {
    const bins = { ...emptyBins, [binLabel]: 1 }
    await setDoc(histRef, {
      milestoneIndex,
      bins,
      totalCount: 1,
      sumScores: score,
      averageScore: score,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }
}
