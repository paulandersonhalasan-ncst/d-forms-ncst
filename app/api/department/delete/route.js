// app/api/department/delete/route.js
import { prisma } from "../../../../prisma/prisma";

export async function POST(request) {
  try {
    const req = await request.json().catch(() => null);
    const items = Array.isArray(req) ? req : req ? [req] : [];

    if (items.length === 0) {
      return Response.json({ success: false, message: "Walang data na ipinadala para i-delete." }, { status: 400 });
    }

    const deleted = [];

    for (const it of items) {
      if (!it || (!it.id && !it.code)) {
        return Response.json({ success: false, message: "Kulang ang identifier (id or code) para sa isang department." }, { status: 400 });
      }

      let existing = null;
      if (it.id) existing = await prisma.department.findUnique({ where: { id: it.id } });
      if (!existing && it.code) existing = await prisma.department.findFirst({ where: { code: String(it.code).toUpperCase().trim() } });

      if (!existing) {
        return Response.json({ success: false, message: `Department not found for identifier: ${it.code || it.id}` }, { status: 404 });
      }

      // Prevent deletion if users exist in this department
      const usersCount = await prisma.user.count({ where: { departmentCode: existing.code } });
      if (usersCount > 0) {
        return Response.json({ success: false, message: `Cannot delete department [${existing.code}] because ${usersCount} user(s) are assigned to it.` }, { status: 400 });
      }

      const del = await prisma.department.delete({ where: { id: existing.id } });
      deleted.push({ id: del.id, code: del.code });
    }

    return Response.json({ success: true, message: `Deleted ${deleted.length} department(s).`, departments: deleted });
  } catch (error) {
    console.error("Error sa Delete Department Route:", error);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
