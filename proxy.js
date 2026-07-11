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
      //console.log(`decrypted user info: ${user.email} | Role: ${user.role}`);
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

  // 🎯 RUNTIME CHECK: Aktibo bang OIC ang user ngayon?
  const isCurrentlyOIC = (() => {
    if (!user || !user.oic_start || !user.oic_end) return false;
    const ngayon = new Date();
    const simula = new Date(user.oic_start);
    const tapos = new Date(user.oic_end);
    tapos.setHours(23, 59, 59, 999); // Isama ang buong huling araw ng term
    return ngayon >= simula && ngayon <= tapos;
  })();

  // 🛡️ REUSABLE VALIDATOR HELPER
  const denyIfNotRole = (allowedRoles) => {
    if (!user) return NextResponse.redirect(loginURL);
    
    // Custom exception para sa OIC: Kung kasama sa allowed list ang 'OIC' at active ang status niya, LIGTAS!
    if (allowedRoles.includes('OIC') && isCurrentlyOIC) return null;
    
    // Kung hindi, babagsak sa normal na role checking ng database record
    if (!allowedRoles.includes(role)) return NextResponse.redirect(unauthorizedURL);
    return null;
  };

  // ----------------------------------------------------------------
  // MULTI ROLE PAGES
  // ----------------------------------------------------------------
  if (request.nextUrl.pathname.startsWith('/dashboard/manage_staff')) {
    // 🟢 Dito natin hahayaan si Staff na makapasok dahil may validation exception sa itaas!
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

  if (request.nextUrl.pathname.startsWith('/dashboard/staff')) {
    const denied = denyIfNotRole(['Staff', 'Faculty']);
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

  // ----------------------------------------------------------------
  // FRONTEND AUTHENTICATED LOGIN REDIRECT HANDLER
  // ----------------------------------------------------------------
  // 🛠️ Palitan mo ang dulo ng iyong proxy.js (ang redirect handler) gamit ito:
  // if (request.nextUrl.pathname === '/' && user) {
  //   // Gumamit ng request.nextUrl.clone() para manatili sa tamang LAN IP base domain
  //   const targetUrl = request.nextUrl.clone();
    
  //   if (role === 'SuperUser') targetUrl.pathname = '/dashboard/superuser';
  //   else if (role === 'DepartmentHead') targetUrl.pathname = '/dashboard/dept_head';
  //   else if (role === 'Staff' || role === 'Faculty') targetUrl.pathname = '/dashboard/staff';
  //   else if (role === 'Admin') targetUrl.pathname = '/dashboard/admin';
  //   else if (role === 'OIC') targetUrl.pathname = '/dashboard/oic';
  //   else return NextResponse.next();

  //   return NextResponse.redirect(targetUrl);
  // }
  if (request.nextUrl.pathname === '/' && user) {
    const targetUrl = request.nextUrl.clone();
    targetUrl.pathname = '/dashboard/analytics'; // Lahat ng users, i-redirect sa /dashboard
    return NextResponse.redirect(targetUrl);
  }
}

export default proxy;