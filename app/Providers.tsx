'use client'

import { BootShell } from './miniapp/BootShell'

export default function Providers({ children }: { children: React.ReactNode }) {
  return <BootShell>{children}</BootShell>
}
