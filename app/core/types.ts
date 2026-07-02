export interface ProofLink {
  title: string
  url: string
}

export interface MilestoneData {
  officialDate: string
  summary?: string
  notes?: string
  proofs?: ProofLink[]
  images?: {
    main?: string
    image2?: string
    image3?: string
  }
}

export interface SnapshotManifest {
  icfHash: string
  icfUrl: string
  name?: string
}

export type AttestationType = 'outcomes' | 'reporting'

export interface AttestRouteParams {
  projectId: string
  folderId: string
  snapshotId: string
  milestoneIndex: number
}
