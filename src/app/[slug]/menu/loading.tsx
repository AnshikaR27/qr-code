export default function MenuLoading() {
  return (
    <main
      className="max-w-[480px] mx-auto min-h-[100dvh] relative"
      style={{ backgroundColor: '#fdf9f0' }}
    >
      <style>{`
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .skel {
          background: linear-gradient(90deg, #e8e0d0 25%, #f0e8d8 37%, #e8e0d0 63%);
          background-size: 800px 100%;
          animation: shimmer 1.4s ease-in-out infinite;
        }
      `}</style>

      {/* Hero */}
      <div className="skel" style={{ width: '100%', height: '25dvh' }} />

      {/* Logo circle */}
      <div className="flex justify-center" style={{ marginTop: -36, position: 'relative', zIndex: 1 }}>
        <div
          className="skel rounded-full border-4 border-white"
          style={{ width: 72, height: 72 }}
        />
      </div>

      {/* Title */}
      <div className="flex justify-center mt-3">
        <div className="skel" style={{ width: 180, height: 24, borderRadius: 8 }} />
      </div>

      {/* Tagline */}
      <div className="flex justify-center mt-2">
        <div className="skel" style={{ width: 140, height: 14, borderRadius: 6 }} />
      </div>

      {/* Category grid */}
      <div
        className="grid grid-cols-2 mt-6"
        style={{ gap: 12, paddingLeft: 16, paddingRight: 16 }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div key={i}>
            <div
              className="skel"
              style={{ aspectRatio: '3/2', borderRadius: 12, marginBottom: 8 }}
            />
            <div className="skel" style={{ width: '60%', height: 14, borderRadius: 6 }} />
          </div>
        ))}
      </div>
    </main>
  );
}
