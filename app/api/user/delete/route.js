// app/api/user/delete/route.js
import { prisma } from "../../../../prisma/prisma";

export async function POST(request) {
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

    return Response.json({ success: true, message: `Na-delete ang ${deletedUsers.length} na user(s).`, users: deletedUsers });

  } catch (error) {
    console.error("Error sa Delete User Route:", error);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
//delete user API endpoint