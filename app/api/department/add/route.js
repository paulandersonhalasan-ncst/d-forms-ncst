// app/api/department/add/route.js (I-adjust mo ang path ng folder kung iba ang pangalan)
import { prisma } from "../../../../prisma/prisma";
import { jwtVerify } from "jose";
import { logActivity } from "../../../lib/logger";

export async function POST(request) {
  try {
    const req = await request.json();

    // 🆕 HAKBANG 1: Gawing array ang input para kahit isa o marami, parehong gagana
    const departmentsArray = Array.isArray(req) ? req : [req];

    if (departmentsArray.length === 0) {
      return Response.json(
        { success: false, message: "Walang data na ipinadala sa request body." },
        { status: 400 }
      );
    }

    const formattedDepartments = departmentsArray.map((dept) => ({
      code: dept.code?.toUpperCase().trim()
    }));

    for (const dept of formattedDepartments) {
      if (!dept.code) {
        return Response.json(
          { success: false, message: "May kulang na 'code' sa isa sa mga departament" },
          { status: 400 }
        );
      }
    }

    const codesToCheck = formattedDepartments.map(d => d.code);
    const existingDepts = await prisma.department.findMany({
      where: { code: { in: codesToCheck } }
    });

    if (existingDepts.length > 0) {
      const duplicateCodes = existingDepts.map(d => d.code).join(", ");
      return Response.json(
        { 
          success: false, 
          message: `Hindi pwedeng ituloy. Ang mga sumusunod na code ay rehistrado na sa database: [${duplicateCodes}]` 
        },
        { status: 409 }
      );
    }

    const result = await prisma.department.createMany({
      data: formattedDepartments,
      skipDuplicates: true, //Para siguradong walang error kung may sumabot na duplicate
    });

    // try to capture requester info and log activity
    try {
      const cookieHeader = request.headers.get("cookie") || "";
      let requesterId = null;
      let requesterEmail = null;
      if (cookieHeader) {
        const cookieParts = cookieHeader.split(";").map((c) => c.trim());
        const sessionCookie = cookieParts.find((c) => c.startsWith("session_token="));
        if (sessionCookie) {
          try {
            const token = sessionCookie.split("=")[1];
            const secret = new TextEncoder().encode(process.env.JWT_SECRET);
            const { payload } = await jwtVerify(token, secret);
            requesterId = payload?.id ? String(payload.id) : null;
            requesterEmail = payload?.email || null;
          } catch (err) {
            console.error("Failed to verify session token in dept add route:", err);
          }
        }
      }

      await logActivity({ req: request, userId: requesterId, email: requesterEmail, action: "CREATE_DEPARTMENTS", details: JSON.stringify({ count: result.count, codes: formattedDepartments.map(d => d.code) }) });
    } catch (err) {
      console.error("Failed to log department add activity:", err);
    }

    return Response.json(
      {
        success: true,
        message: `${result.count} departments added`,
        count: result.count
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Error sa Bulk Add Department Route:", error);
    return Response.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}