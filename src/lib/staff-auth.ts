import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { StaffSession } from '@/types';

const COOKIE_NAME = 'staff_session';
const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '12h';

function getSecret() {
  const secret = process.env.STAFF_JWT_SECRET;
  if (!secret) throw new Error('STAFF_JWT_SECRET is not set');
  return new TextEncoder().encode(secret);
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, SALT_ROUNDS);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

export async function createStaffToken(session: StaffSession): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(getSecret());
}

export async function verifyStaffToken(token: string): Promise<StaffSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      staff_id: payload.staff_id as string,
      restaurant_id: payload.restaurant_id as string,
      restaurant_slug: payload.restaurant_slug as string,
      name: payload.name as string,
      role: payload.role as StaffSession['role'],
    };
  } catch {
    return null;
  }
}

export async function getStaffSession(): Promise<StaffSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyStaffToken(token);
}

export function getStaffCookieName() {
  return COOKIE_NAME;
}
