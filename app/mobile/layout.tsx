import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Mobile attest',
  description: 'Member attestation surface',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0f172a',
}

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {children}
    </div>
  )
}
