import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/client'

const ATTESTER_ROLES = ['owner', 'wisdomCouncil', 'attester'] as const

/** Wallet doc IDs may be stored lowercased (attestation portal convention). */
export function normalizeWalletAddress(address: string): string {
  return address.toLowerCase()
}

export async function checkMemberCanAttest(
  projectId: string,
  walletAddress: string
): Promise<{ authorized: boolean; roles: string[] }> {
  const normalized = normalizeWalletAddress(walletAddress)
  const memberRef = doc(db, 'newsroom', projectId, 'members', normalized)
  const memberSnap = await getDoc(memberRef)

  if (!memberSnap.exists()) {
    return { authorized: false, roles: [] }
  }

  const memberData = memberSnap.data()
  const roles: string[] = memberData.roles || (memberData.role ? [memberData.role] : [])
  const authorized = roles.some((role) =>
    ATTESTER_ROLES.includes(role as (typeof ATTESTER_ROLES)[number])
  )

  return { authorized, roles }
}
