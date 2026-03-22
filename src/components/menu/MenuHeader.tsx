import Image from 'next/image';
import { MapPin, Clock } from 'lucide-react';
import type { Restaurant } from '@/types';

interface Props { restaurant: Restaurant }

export default function MenuHeader({ restaurant }: Props) {
  const { primary_color, name, city, logo_url } = restaurant;

  return (
    <div className="bg-white border-b border-gray-200">
      {/* Top brand bar */}
      <div
        className="h-1.5 w-full"
        style={{ background: `linear-gradient(90deg, ${primary_color}, ${primary_color}99)` }}
      />

      <div className="px-4 pt-4 pb-4">
        <div className="flex items-center gap-3.5">
          {/* Logo */}
          <div
            className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center border border-gray-100"
            style={{ backgroundColor: `${primary_color}12` }}
          >
            {logo_url ? (
              <Image src={logo_url} alt={name} width={64} height={64} className="object-cover w-full h-full" />
            ) : (
              <span
                className="text-2xl font-black"
                style={{ color: primary_color }}
              >
                {name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-gray-900 leading-tight truncate">{name}</h1>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
              {city && (
                <span className="flex items-center gap-1 text-xs text-gray-500 font-medium">
                  <MapPin className="w-3 h-3" />
                  {city}
                </span>
              )}
              <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#1ca672' }}>
                <Clock className="w-3 h-3" />
                Open Now
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
