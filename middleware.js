// middleware.js
import { NextResponse } from 'next/server';

import { jwtVerify } from 'jose';

export async function middleware(request) {
  const path = request.nextUrl.pathname;

  const token = request.cookies.get('session_token')?.value;

  let user = null;

  if (token) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      
      const { payload } = await jwtVerify(token, secret);
      user = payload; 

      console.log(`decrypted user info (for debug only): ${user.employee_id} | Role: ${user.role}`);
    } catch (error) {
      console.error('❌ Token Error (Expired, Peke, o Corrupted), redirecting to login page.:', error.message);
      
      // redirect to the public login page and clear cookie
      const response = NextResponse.redirect(new URL('/', request.url));
      response.cookies.delete('session_token');
      return response;
    }
  }

  // RBAC: normalize role casing to avoid mismatches between DB and checks
  // RBAC: use DB role values as-is (case-sensitive)
  const role = user?.role ?? null;

  // Check dashboard routes (your pages live under /dashboard/*)
  if (request.nextUrl.pathname.startsWith('/dashboard/superuser')) {
    if (!user) return NextResponse.rewrite(new URL('/', request.url));
    if (role !== 'SuperUser') return NextResponse.rewrite(new URL('/403-unauthorized', request.url));
  }

  if (request.nextUrl.pathname.startsWith('/dashboard/dept_head')) {
    if (!user) return NextResponse.rewrite(new URL('/', request.url));
    if (role !== 'DepartmentHead' && role !== 'depthead') return NextResponse.rewrite(new URL('/403-unauthorized', request.url));
  }

  if (request.nextUrl.pathname.startsWith('/dashboard/coadmin')) {
    if (!user) return NextResponse.rewrite(new URL('/', request.url));
    if (role !== 'CoAdmin') return NextResponse.rewrite(new URL('/403-unauthorized', request.url));
  }

  if (request.nextUrl.pathname.startsWith('/dashboard/staff')) {
    if (!user) return NextResponse.rewrite(new URL('/', request.url));
    if (role !== 'Staff') return NextResponse.rewrite(new URL('/403-unauthorized', request.url));
  }

  // If an authenticated user hits the frontend login page (`/`), send them to their dashboard
  if (request.nextUrl.pathname === '/' && user) {
    if (role === 'SuperUser') return NextResponse.rewrite(new URL('/dashboard/superuser', request.url));
    if (role === 'DepartmentHead') return NextResponse.rewrite(new URL('/dashboard/dept_head', request.url));
    if (role === 'CoAdmin') return NextResponse.rewrite(new URL('/dashboard/coadmin', request.url));
    if (role === 'Staff') return NextResponse.rewrite(new URL('/dashboard/staff', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/superuser/:path*',
    '/dashboard/dept_head/:path*',
    '/dashboard/coadmin/:path*',
    '/dashboard/staff/:path*',
    '/',
  ],
};