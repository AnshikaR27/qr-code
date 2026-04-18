import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(amount: number): string {
  return `₹${amount.toFixed(2).replace(/\.00$/, '')}`;
}

export function getContrastText(hex: string): '#FFFFFF' | '#1D1D1D' {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1D1D1D' : '#FFFFFF';
}

export function getSafeAccent(hexColor: string): string {
  const hex = hexColor.startsWith('#') ? hexColor.slice(1) : hexColor;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (luminance > 0.7) {
    return `rgb(${Math.floor(r * 0.6)}, ${Math.floor(g * 0.6)}, ${Math.floor(b * 0.6)})`;
  }
  return hexColor;
}

// Creates a very dark version of any color for premium dark backgrounds
export function getDarkBrand(hexColor: string): string {
  const hex = hexColor.startsWith('#') ? hexColor.slice(1) : hexColor;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // Darken to ~8-12% of original — creates a rich deep tone
  return `rgb(${Math.floor(r * 0.1 + 5)}, ${Math.floor(g * 0.1 + 5)}, ${Math.floor(b * 0.1 + 5)})`;
}

// Slightly lighter version for navbar distinction
export function getNavbarBrand(hexColor: string): string {
  const hex = hexColor.startsWith('#') ? hexColor.slice(1) : hexColor;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // Darken to ~15-18% of original — slightly lighter than page bg
  return `rgb(${Math.floor(r * 0.15 + 10)}, ${Math.floor(g * 0.15 + 10)}, ${Math.floor(b * 0.15 + 10)})`;
}

/**
 * Returns a Cloudinary URL resized to w×h with auto quality and format.
 * Strips any existing transformation params already in the stored URL.
 * Square dimensions (w === h) use c_fill; different dimensions use c_limit.
 * Non-Cloudinary URLs pass through unchanged.
 */
export function cdnImg(url: string | null | undefined, w: number, h = w): string {
  if (!url) return '';
  const uploadIdx = url.indexOf('/image/upload/');
  if (uploadIdx === -1) return url;
  const base = url.slice(0, uploadIdx + '/image/upload/'.length);
  const rest = url.slice(base.length);
  // Strip existing Cloudinary transform segments (they contain _ or ,) before version/public_id
  const cleaned = rest.replace(/^(?:[^/]*[_,][^/]*\/)+/, '');
  const crop = w === h ? 'c_fill' : 'c_limit';
  return `${base}w_${w},h_${h},${crop},q_auto,f_auto/${cleaned}`;
}

/** Returns a tiny blurry Cloudinary URL for use as an LQIP background placeholder. */
export function cdnBlur(url: string | null | undefined): string {
  if (!url) return '';
  const uploadIdx = url.indexOf('/image/upload/');
  if (uploadIdx === -1) return url;
  const base = url.slice(0, uploadIdx + '/image/upload/'.length);
  const rest = url.slice(base.length);
  const cleaned = rest.replace(/^(?:[^/]*[_,][^/]*\/)+/, '');
  return `${base}w_20,h_20,f_auto,q_10,e_blur:500/${cleaned}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
