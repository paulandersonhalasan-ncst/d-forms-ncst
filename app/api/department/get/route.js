// app/api/department/get/route.js
import { prisma } from "../../../../prisma/prisma";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const codeParam = searchParams.get("code");

    if (codeParam) {
      const code = String(codeParam).toUpperCase().trim();
      const dept = await prisma.department.findFirst({ where: { code } });
      if (!dept) {
        return Response.json({ success: false, message: "Department not found." }, { status: 404 });
      }
      return Response.json({ success: true, data: dept });
    }

    const all = await prisma.department.findMany({ orderBy: { code: "asc" } });
    return Response.json({ success: true, count: all.length, data: all });
  } catch (error) {
    console.error("Error sa Get Department Route:", error);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
