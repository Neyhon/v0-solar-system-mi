'use client'

import dynamic from 'next/dynamic'

const SpaceGame = dynamic(() => import('@/components/space-game/SpaceGame'), {
  ssr: false,
  loading: () => (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 50% 20%, #1b2a61 0%, #090f26 55%, #060815 100%)',
      color: '#f7f8ff',
      fontFamily: '"Trebuchet MS", "Century Gothic", Verdana, sans-serif',
      fontSize: 'clamp(1rem, 2.5vw, 1.5rem)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '60px',
          height: '60px',
          margin: '0 auto 1rem',
          border: '4px solid rgba(70, 167, 255, 0.3)',
          borderTopColor: '#46a7ff',
          borderRadius: '50%',
          animation: 'spin 5s linear infinite',
        }} />
        <p>Preparando misión espacial...</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  ),
})

export default function Home() {
  return <SpaceGame />
}
