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
      console.log(`decrypted user info: ${user.email} | Role: ${user.role}`);
    } catch (error) {
      console.error('❌ Token Error:', error.message);
      const response = NextResponse.redirect(new URL('/', request.url));
      response.cookies.delete('session_token');
      return response;
    }
  }

  const role = user?.role ?? null;
  const unauthorizedURL = new URL('/unauthorized', request.url);
  const loginURL = new URL('/', request.url);

  const denyIfNotRole = (allowedRoles) => {
    if (!user) return NextResponse.rewrite(loginURL);
    if (!allowedRoles.includes(role)) return NextResponse.rewrite(unauthorizedURL);
    return null;
  };

  // ----------------------------------------------------------------
  // MULTI ROLE PAGES
  // ----------------------------------------------------------------
  if (request.nextUrl.pathname.startsWith('/dashboard/manage_staff')) {
    const denied = denyIfNotRole(['OIC', 'DepartmentHead']);
    if (denied) return denied;
  }

  if (request.nextUrl.pathname.startsWith('/dashboard/manage_users')) {
    const denied = denyIfNotRole(['Admin', 'SuperUser']);
    if (denied) return denied;
  }

  if (request.nextUrl.pathname.startsWith('/dashboard/activity_logs')) {
    const denied = denyIfNotRole(['Admin', 'SuperUser']);
    if (denied) return denied;
  }

  // ----------------------------------------------------------------
  // GLOBAL ROLE DIRECTORY FILTERS
  // ----------------------------------------------------------------
  if (request.nextUrl.pathname.startsWith('/dashboard/dept_head')) {
    const denied = denyIfNotRole(['DepartmentHead', 'OIC']);
    if (denied) return denied;
  }

  if (request.nextUrl.pathname.startsWith('/dashboard/superuser')) {
    const denied = denyIfNotRole(['SuperUser']);
    if (denied) return denied;
  }

  // Dahil nauna na sa itaas ang '/dashboard/manage_staff', ligtas na itong basahin ngayon!
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

  // Frontend authenticated login redirect handler
  if (request.nextUrl.pathname === '/' && user) {
    if (role === 'SuperUser') return NextResponse.rewrite(new URL('/dashboard/superuser', request.url));
    if (role === 'DepartmentHead') return NextResponse.rewrite(new URL('/dashboard/dept_head', request.url));
    if (role === 'Staff') return NextResponse.rewrite(new URL('/dashboard/staff', request.url));
    if (role === 'Admin') return NextResponse.rewrite(new URL('/dashboard/admin', request.url));
    if (role === 'OIC') return NextResponse.rewrite(new URL('/dashboard/oic', request.url));
  }

  return NextResponse.next();
}

export default proxy;

export const config = {
  matcher: [
    '/dashboard/superuser/:path*',
    '/dashboard/dept_head/:path*',
    '/dashboard/oic/:path*',
    '/dashboard/staff/:path*',
    '/dashboard/admin/:path*',

    '/dashboard/manage_users',
    '/dashboard/manage_users/:path*',

    '/dashboard/activity_logs',
    '/dashboard/activity_logs/:path*',

    '/dashboard/manage_staff',
    '/dashboard/manage_staff/:path*',
    '/',
  ],
};