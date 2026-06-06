// app/api/user/delete/route.js
import { prisma } from "../../../../prisma/prisma";
import { jwtVerify } from "jose";
import { logActivity } from "../../../lib/logger";

export async function POST(request) {
  // determine requester from session_token cookie (if present)
  const cookieHeader = request.headers.get("cookie") || "";
  let requesterId = null;
  let requesterEmail = null;
  if (cookieHeader) {
    try {
      const cookieParts = cookieHeader.split(";").map((c) => c.trim());
      const sessionCookie = cookieParts.find((c) => c.startsWith("session_token="));
      if (sessionCookie) {
        const token = sessionCookie.split("=")[1];
        const secret = new TextEncoder().encode(process.env.JWT_SECRET);
        const { payload } = await jwtVerify(token, secret);
        requesterId = payload && payload.id ? String(payload.id) : null;
        requesterEmail = payload && payload.email ? String(payload.email) : null;
      }
    } catch (err) {
      console.error("Failed to verify session token in delete route:", err);
    }
  }
  try {
    const req = await request.json().catch(() => null);
    const usersArray = Array.isArray(req) ? req : req ? [req] : [];

    if (usersArray.length === 0) {
      return Response.json({ success: false, message: "Walang data na ipinadala para i-delete." }, { status: 400 });
    }

    const deletedUsers = [];

    for (const userData of usersArray) {
      if (!userData || (!userData.id && !userData.email)) {
        return Response.json({ success: false, message: "Kulang ang identifier (id or email) para sa isang user." }, { status: 400 });
      }

      // Find user first
      let existing = null;
      if (userData.id) existing = await prisma.user.findUnique({ where: { id: userData.id } });
      if (!existing && userData.email) existing = await prisma.user.findUnique({ where: { email: userData.email.toLowerCase().trim() } });

      if (!existing) {
        return Response.json({ success: false, message: `User not found for identifier: ${userData.email || userData.employee_id || userData.id}` }, { status: 404 });
      }

      const deleted = await prisma.user.delete({ where: { id: existing.id } });
      deletedUsers.push({ id: deleted.id, email: deleted.email, employee_id: deleted.employee_id });
    }

    // log deletion activity
    try {
      await logActivity({ req: request, userId: requesterId, email: requesterEmail, action: "DELETE_USERS", details: JSON.stringify({ deleted: deletedUsers.map((u) => u.id) }) });
    } catch (err) {
      console.error("Failed to log delete users activity:", err);
    }

    return Response.json({ success: true, message: `Na-delete ang ${deletedUsers.length} na user(s).`, users: deletedUsers });

  } catch (error) {
    console.error("Error sa Delete User Route:", error);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
//delete user API endpoint