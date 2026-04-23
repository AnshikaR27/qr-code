import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MenuQR',
    short_name: 'MenuQR',
    description: 'Digital menu for restaurants',
    start_url: '/staff/login',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#09090b',
  };
}
