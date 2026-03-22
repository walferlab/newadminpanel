'use client'
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html><body style={{ background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'ui-sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Something went wrong</p>
        <button onClick={reset} style={{ color: '#888', fontSize: 13, marginTop: 12, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
          Try again
        </button>
      </div>
    </body></html>
  )
}
