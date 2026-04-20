export default function SlugLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-[100dvh]"
      style={{ backgroundColor: '#fdf9f0' }}
    >
      {children}
    </div>
  );
}
