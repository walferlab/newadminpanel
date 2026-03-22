import type { ReactNode } from 'react'
import Image from 'next/image'

interface AuthFrameProps {
  title: string
  subtitle: string
  children: ReactNode
}

export function AuthFrame({ title, subtitle, children }: AuthFrameProps) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#080808' }}
    >
      <div
        className="w-full max-w-md"
        style={{
          background: 'rgba(14,14,14,0.97)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: 32,
        }}
      >
        <div className="mb-6 text-center">
          <Image
            src="/logo.png"
            alt="PDF Lovers"
            width={44}
            height={44}
            className="mx-auto"
            priority
            style={{ borderRadius: 10 }}
          />
          <h1
            style={{
              fontFamily: "'Satoshi', ui-sans-serif",
              fontWeight: 700,
              fontSize: 20,
              letterSpacing: '-0.025em',
              color: '#fff',
              marginTop: 14,
            }}
          >
            {title}
          </h1>
          <p style={{ fontSize: 13, color: '#555', marginTop: 4 }}>{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  )
}
