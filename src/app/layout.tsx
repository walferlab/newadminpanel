import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Toaster } from 'react-hot-toast'
import { AppShell } from '@/components/layout/AppShell'
import '@/app/globals.css'

export const metadata: Metadata = {
  title: 'PDF Lovers Admin',
  description: 'Admin panel for pdflovers.app',
  icons: {
    icon: [{ url: '/favicon.ico', sizes: 'any' }, { url: '/logo.png', type: 'image/jpeg' }],
    shortcut: ['/favicon.ico'],
    apple: ['/logo.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <head>
          <link
            href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700,800&display=swap"
            rel="stylesheet"
          />
        </head>
        <body
          style={{
            background: '#080808',
            color: '#e0e0e0',
            fontFamily: "'Satoshi', 'Be Vietnam Pro', ui-sans-serif, system-ui, sans-serif",
          }}
        >
          <AppShell>{children}</AppShell>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: 'rgba(14,14,14,0.98)',
                color: '#e0e0e0',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: '10px',
                fontSize: '13px',
                fontFamily: "'Satoshi', ui-sans-serif",
              },
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  )
}
