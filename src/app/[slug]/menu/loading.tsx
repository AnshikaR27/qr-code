export default function MenuLoading() {
  return (
    <div
      className="max-w-[480px] mx-auto min-h-[100dvh] flex flex-col items-center justify-center gap-5"
      style={{
        backgroundColor: '#fdf9f0',
        fontFamily: "'Manrope', system-ui, sans-serif",
      }}
    >
      <div className="flex gap-[6px]">
        <span className="inline-block w-[10px] h-[10px] rounded-full animate-[bounce1_1.4s_ease-in-out_infinite]" style={{ backgroundColor: '#b12d00' }} />
        <span className="inline-block w-[10px] h-[10px] rounded-full animate-[bounce1_1.4s_ease-in-out_0.2s_infinite]" style={{ backgroundColor: '#b12d00' }} />
        <span className="inline-block w-[10px] h-[10px] rounded-full animate-[bounce1_1.4s_ease-in-out_0.4s_infinite]" style={{ backgroundColor: '#b12d00' }} />
      </div>

      <div className="relative h-[24px] overflow-hidden">
        <div className="animate-[msgCycle_8s_ease-in-out_infinite]">
          {[
            'Bribing the chef with compliments…',
            'Teaching the naan to flip…',
            'Taste-testing everything twice…',
            'Arguing with the spices…',
          ].map((msg) => (
            <p
              key={msg}
              className="h-[24px] text-[15px] font-medium text-center leading-[24px]"
              style={{ color: '#7A6040' }}
            >
              {msg}
            </p>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes bounce1 {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-12px); }
        }
        @keyframes msgCycle {
          0%, 20%   { transform: translateY(0); }
          25%, 45%  { transform: translateY(-24px); }
          50%, 70%  { transform: translateY(-48px); }
          75%, 95%  { transform: translateY(-72px); }
          100%      { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
