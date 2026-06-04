// app/api/user/edit/route.js
import { prisma } from "../../../../prisma/prisma";

export async function POST(request) {
  try {
    const req = await request.json().catch(() => null);
    const usersArray = Array.isArray(req) ? req : req ? [req] : [];

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
      const allowed = ["employee_id", "password", "fname", "lname", "role", "branch", "departmentCode"];
      for (const key of allowed) {
        if (userData[key] !== undefined && userData[key] !== null) {
          // normalize email and employee_id
          if (key === "email") updateData.email = String(userData.email).toLowerCase().trim();
          else if (key === "employee_id") updateData.employee_id = String(userData.employee_id).trim();
          else updateData[key] = userData[key];
        }
      }

      if (Object.keys(updateData).length === 0) {
        return Response.json({ success: false, message: `Walang fields na i-update para sa user: ${existing.email || existing.employee_id || existing.id}` }, { status: 400 });
      }

      const updated = await prisma.user.update({ where: { id: existing.id }, data: updateData });

      updatedUsers.push({ id: updated.id, email: updated.email, employee_id: updated.employee_id, role: updated.role });
    }

    return Response.json({ success: true, message: `Na-update ang ${updatedUsers.length} na user(s).`, users: updatedUsers });

  } catch (error) {
    console.error("Error sa Edit User Route:", error);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
//edit user API endpoint