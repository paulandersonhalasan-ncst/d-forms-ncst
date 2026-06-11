// proxy.js
import { NextResponse } from 'next/server';

import { jwtVerify } from 'jose';

export async function proxy(request) {

  const token = request.cookies.get('session_token')?.value;

  let user = null;

  if (token) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      
      const { payload } = await jwtVerify(token, secret);
      user = payload; 

      console.log(`decrypted user info (for debug only): ${user.email} | Role: ${user.role}`);
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
  const unauthorizedURL = new URL('/unauthorized', request.url);
  const loginURL = new URL('/', request.url);

  const denyIfNotRole = (allowedRoles) => {
    if (!user) return NextResponse.rewrite(loginURL);
    if (!allowedRoles.includes(role)) return NextResponse.rewrite(unauthorizedURL);
    return null;
  };

  // Check dashboard routes (your pages live under /dashboard/*)
  if (request.nextUrl.pathname.startsWith('/dashboard/superuser')) {
    const denied = denyIfNotRole(['SuperUser']);
    if (denied) return denied;
  }

  if (request.nextUrl.pathname.startsWith('/dashboard/dept_head')) {
    const denied = denyIfNotRole(['DepartmentHead', 'depthead']);
    if (denied) return denied;
  }

  if (request.nextUrl.pathname.startsWith('/dashboard/staff')) {
    const denied = denyIfNotRole(['Staff']);
    if (denied) return denied;
  }

  if (request.nextUrl.pathname.startsWith('/dashboard/admin')) {
    const denied = denyIfNotRole(['Admin']);
    if (denied) return denied;
  }

  if (request.nextUrl.pathname.startsWith('/dashboard/oic')) {
    const denied = denyIfNotRole(['OIC']);
    if (denied) return denied;
  }

  // If an authenticated user hits the frontend login page (`/`), send them to their dashboard
  if (request.nextUrl.pathname === '/' && user) {
    if (role === 'SuperUser') return NextResponse.rewrite(new URL('/dashboard/superuser', request.url));
    if (role === 'DepartmentHead') return NextResponse.rewrite(new URL('/dashboard/dept_head', request.url));
    if (role === 'Staff') return NextResponse.rewrite(new URL('/dashboard/staff', request.url));
    if (role === 'Admin') return NextResponse.rewrite(new URL('/dashboard/admin', request.url));
    if (role === 'OIC') return NextResponse.rewrite(new URL('/dashboard/oic', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/superuser/:path*',
    '/dashboard/dept_head/:path*',
    '/dashboard/oic/:path*',
    '/dashboard/staff/:path*',
    '/dashboard/admin/:path*',
    '/',
  ],
};