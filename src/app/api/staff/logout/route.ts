import { NextResponse } from 'next/server';
import { getStaffCookieName } from '@/lib/staff-auth';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(getStaffCookieName(), '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
