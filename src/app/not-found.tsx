import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: '#080808',
      fontFamily: "'Satoshi', ui-sans-serif",
    }}>
      <p style={{ fontSize: 72, fontWeight: 700, color: '#fff', letterSpacing: '-0.05em', lineHeight: 1 }}>404</p>
      <p style={{ fontSize: 16, color: '#555', marginTop: 12, marginBottom: 24 }}>Page not found</p>
      <Link href="/dashboard" style={{ fontSize: 13, color: '#888', textDecoration: 'underline' }}>
        Back to Dashboard
      </Link>
    </div>
  )
}
