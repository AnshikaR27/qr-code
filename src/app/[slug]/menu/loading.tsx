export default function MenuLoading() {
  return (
    <div
      className="max-w-[480px] mx-auto min-h-[100dvh] flex flex-col items-center justify-center"
      style={{
        backgroundColor: '#fdf9f0',
        fontFamily: "'Manrope', system-ui, sans-serif",
      }}
    >
      <p
        className="text-[28px] font-bold tracking-tight animate-[menuPulse_2s_ease-in-out_infinite]"
        style={{ color: '#1A1A1A' }}
      >
        Sunday
      </p>
      <p
        className="mt-3 text-[15px] animate-[menuPulse_2s_ease-in-out_infinite_0.3s]"
        style={{ color: '#7A6040' }}
      >
        Warming up the kitchen…
      </p>

      <style>{`
        @keyframes menuPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
