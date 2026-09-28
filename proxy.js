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
    } catch (error) {
      console.error('❌ Token Error:', error.message);
      const response = NextResponse.redirect(new URL('/', request.url));
      response.cookies.delete('session_token');
      return response;
    }
  }

  const unauthorizedURL = new URL('/unauthorized', request.url);
  const loginURL = new URL('/', request.url);

  const isCurrentlyOIC = (() => {
    if (!user || !user.oic_start || !user.oic_end) return false;
    const ngayon = new Date();
    const simula = new Date(user.oic_start);
    const tapos = new Date(user.oic_end);
    tapos.setHours(23, 59, 59, 999);
    return ngayon >= simula && ngayon <= tapos;
  })();

  const denyIfNotRole = (allowedRoles) => {
    if (!user) return NextResponse.redirect(loginURL);
    if (allowedRoles.includes('OIC') && isCurrentlyOIC) return null;
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.redirect(unauthorizedURL);
    }
    return null;
  };

  const canAccessFRFManage = () => {
      if (!user) return false;
      
      const isITOFMOCDO = user.departmentCode === 'ITO-MAIN' || user.departmentCode === 'ITO' || user.departmentCode === 'CDO' || user.departmentCode === 'PSMO/FMO';
      if (!isITOFMOCDO) return false;
      
      const isSuperUser = user.role === 'SuperUser';
      const isDepartmentHead = user.role === 'DepartmentHead';
      // ✅ Use isCurrentlyOIC (computed above) instead of role === 'OIC'
      // Because OIC status is temporary (via oic_start / oic_end), not a role
      
      return isSuperUser || isDepartmentHead || isCurrentlyOIC;
  };

  // ================================================
  // ROUTE GUARDS
  // ================================================

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

  if (request.nextUrl.pathname.startsWith('/dashboard/dept_head')) {
    const denied = denyIfNotRole(['DepartmentHead', 'OIC']);
    if (denied) return denied;
  }

  if (request.nextUrl.pathname.startsWith('/dashboard/super')) {
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

  if (request.nextUrl.pathname.startsWith('/dashboard/super/backup')) {
    const denied = denyIfNotRole(['SuperUser']);
    if (denied) return denied;
  }

  if (request.nextUrl.pathname.startsWith('/dashboard/forms/frf/manage')) {
    if (!canAccessFRFManage()) {
      return NextResponse.redirect(unauthorizedURL);
    }
  }

  if (request.nextUrl.pathname === '/' && user) {
    const targetUrl = request.nextUrl.clone();
    targetUrl.pathname = '/dashboard/analytics';
    return NextResponse.redirect(targetUrl);
  }
}

export default proxy;