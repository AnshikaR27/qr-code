export default function MenuLoading() {
  const skel: React.CSSProperties = {
    background: 'linear-gradient(90deg, #e8e0d0 25%, #f0e8d8 37%, #e8e0d0 63%)',
    backgroundSize: '800px 100%',
    animation: 'skel-shimmer 1.4s ease-in-out infinite',
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', position: 'relative' }}>
      <style>{`
        @keyframes skel-shimmer {
          0% { background-position: -400px 0 }
          100% { background-position: 400px 0 }
        }
      `}</style>

      {/* Hero */}
      <div style={{ ...skel, width: '100%', height: '25dvh' }} />

      {/* Logo circle */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: -36, position: 'relative', zIndex: 1 }}>
        <div
          style={{
            ...skel,
            width: 72,
            height: 72,
            borderRadius: '50%',
            border: '4px solid #fff',
          }}
        />
      </div>

      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
        <div style={{ ...skel, width: 180, height: 24, borderRadius: 8 }} />
      </div>

      {/* Tagline */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
        <div style={{ ...skel, width: 140, height: 14, borderRadius: 6 }} />
      </div>

      {/* Category grid — 2 columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          padding: '24px 16px 0',
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div key={i}>
            <div style={{ ...skel, aspectRatio: '3/2', borderRadius: 12, marginBottom: 8 }} />
            <div style={{ ...skel, width: '60%', height: 14, borderRadius: 6 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
