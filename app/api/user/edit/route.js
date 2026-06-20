// app/api/user/edit/route.js
import { prisma } from "../../../../prisma/prisma";
import { jwtVerify } from "jose";
import { logActivity } from "../../../lib/logger";

export async function POST(request) {
  try {
    const req = await request.json().catch(() => null);
    const usersArray = Array.isArray(req) ? req : req ? [req] : [];

    // determine requester from session_token cookie (if present)
    const cookieHeader = request.headers.get("cookie") || "";
    let requesterId = null;
    let requesterRole = null;
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
          requesterRole = payload && payload.role ? String(payload.role) : null;
          requesterEmail = payload && payload.email ? String(payload.email) : null;
        }
      } catch (err) {
        console.error("Failed to verify session token in edit route:", err);
      }
    }

    if (usersArray.length === 0) {
      return Response.json({ success: false, message: "Walang data na ipinadala para i-edit." }, { status: 400 });
    }

    const updatedUsers = [];

    for (const userData of usersArray) {
      if (!userData || (!userData.id && !userData.email)) {
        return Response.json({ success: false, message: "Kulang ang identifier (id or email) para sa isang user." }, { status: 400 });
      }

      // Find existing user first
      let existing = null;
      if (userData.id) existing = await prisma.user.findUnique({ where: { id: userData.id } });
      if (!existing && userData.email) existing = await prisma.user.findUnique({ where: { email: userData.email.toLowerCase().trim() } });

      if (!existing) {
        return Response.json({ success: false, message: `User not found for identifier: ${userData.email || userData.employee_id || userData.id}` }, { status: 404 });
      }


      // Prepare update payload (allow only specific fields)
      const updateData = {};
      // 1. Idagdag ang dalawang OIC fields sa allowed list
      const allowed = [
        "employee_id",
        "email",
        "password", 
        "fname", 
        "lname", 
        "role", 
        "branch", 
        "departmentCode", 
        "oic_start",
        "oic_end"
      ];

      // Handle password updates specially: require currentPassword for self-updates
      const wantsPasswordUpdate = userData.password !== undefined && userData.password !== null;

      for (const key of allowed) {
        if (key === "password") continue;

        if (userData[key] !== undefined) {
          if (key === "oic_start" || key === "oic_end") {
            updateData[key] =
              userData[key] === "" ||
              userData[key] === null
                ? null
                : String(userData[key]);
          } else if (key === "employee_id") {
            updateData.employee_id = String(userData.employee_id).trim();
          } else {
            updateData[key] = userData[key];
          }
        }
      }

      if (wantsPasswordUpdate) {
        // must have requester info to change password
        if (!requesterId) {
          return Response.json({ success: false, message: "Authentication required to change password." }, { status: 401 });
        }

        // if requester is editing their own account, require currentPassword
        if (String(existing.id) === String(requesterId)) {
          const current = userData.currentPassword;
          if (!current) {
            return Response.json({ success: false, message: "Current password is required." }, { status: 400 });
          }
          if (current !== existing.password) {
            return Response.json({ success: false, message: "Current password is incorrect." }, { status: 401 });
          }
          updateData.password = userData.password;
        } else {
          // changing someone else's password — allow only for privileged roles
          const privileged = ["Admin", "SuperUser"];
          if (!requesterRole || !privileged.includes(requesterRole)) {
            return Response.json({ success: false, message: "Insufficient permissions to change another user's password." }, { status: 403 });
          }
          updateData.password = userData.password;
        }
      }

      if (Object.keys(updateData).length === 0) {
        return Response.json({ success: false, message: `Walang fields na i-update para sa user: ${existing.email || existing.employee_id || existing.id}` }, { status: 400 });
      }

      const updated = await prisma.user.update({ where: { id: existing.id }, data: updateData });

      updatedUsers.push({ id: updated.id, email: updated.email, employee_id: updated.employee_id, role: updated.role });
    }

    // log edit activity
    try {
      await logActivity({ req: request, userId: requesterId, email: requesterEmail || null, action: "EDIT_USERS", details: JSON.stringify({ updated: updatedUsers.map((u) => u.id) }) });
    } catch (err) {
      console.error("Failed to log edit users activity:", err);
    }

    return Response.json({ success: true, message: `Na-update ang ${updatedUsers.length} na user(s).`, users: updatedUsers });

  } catch (error) {
    console.error("Error sa Edit User Route:", error);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
//edit user API endpoint