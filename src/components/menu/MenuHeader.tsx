import Image from 'next/image';
import type { Restaurant } from '@/types';

interface Props { restaurant: Restaurant }

export default function MenuHeader({ restaurant }: Props) {
  const { primary_color, secondary_color, name, city, logo_url } = restaurant;

  return (
    <header
      className="relative w-full overflow-hidden"
      style={{
        background: `linear-gradient(150deg, ${secondary_color} 0%, ${primary_color} 55%, ${secondary_color}cc 100%)`,
        minHeight: '220px',
      }}
    >
      {/* Dot-grid texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.18) 1.5px, transparent 1.5px)`,
          backgroundSize: '22px 22px',
        }}
      />

      {/* Large decorative circle — top right */}
      <div
        className="absolute -top-20 -right-20 w-72 h-72 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)` }}
      />
      {/* Small decorative circle — bottom left */}
      <div
        className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)` }}
      />

      {/* Bottom curve */}
      <div
        className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none"
        style={{
          background: `${primary_color}08`,
          borderRadius: '50% 50% 0 0 / 100% 100% 0 0',
          transform: 'scaleX(1.5)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-5 px-6 pt-12 pb-10">
        {/* Logo */}
        <div className="relative">
          {/* Outer glow ring */}
          <div
            className="absolute inset-0 rounded-full blur-md opacity-60"
            style={{ background: primary_color, transform: 'scale(1.2)' }}
          />
          {logo_url ? (
            <div
              className="relative w-24 h-24 rounded-full overflow-hidden border-[3px] border-white shadow-2xl"
              style={{ boxShadow: `0 0 0 4px rgba(255,255,255,0.25), 0 8px 32px rgba(0,0,0,0.3)` }}
            >
              <Image src={logo_url} alt={name} fill className="object-cover" sizes="96px" />
            </div>
          ) : (
            <div
              className="relative w-24 h-24 rounded-full flex items-center justify-center border-[3px] border-white shadow-2xl"
              style={{
                background: `linear-gradient(135deg, ${primary_color}dd, ${secondary_color}dd)`,
                boxShadow: `0 0 0 4px rgba(255,255,255,0.25), 0 8px 32px rgba(0,0,0,0.3)`,
                fontSize: '2.5rem',
                fontWeight: 900,
                color: 'white',
              }}
            >
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Restaurant name */}
        <div className="text-center">
          <h1
            className="text-3xl font-black text-white tracking-tight leading-none"
            style={{ textShadow: '0 2px 12px rgba(0,0,0,0.3)' }}
          >
            {name}
          </h1>
          {city && (
            <p
              className="text-sm font-semibold mt-2 tracking-widest uppercase"
              style={{ color: 'rgba(255,255,255,0.75)', letterSpacing: '0.15em' }}
            >
              ✦ {city} ✦
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
