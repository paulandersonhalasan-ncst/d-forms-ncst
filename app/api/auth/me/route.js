// app/api/auth/me/route.js
import { prisma } from "../../../../prisma/prisma";
import { jwtVerify } from "jose";

export async function GET(request) {
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader) return Response.json({ success: false, message: "Not authenticated" }, { status: 401 });

    const cookieParts = cookieHeader.split(";").map((c) => c.trim());
    const sessionCookie = cookieParts.find((c) => c.startsWith("session_token="));
    if (!sessionCookie) return Response.json({ success: false, message: "Not authenticated" }, { status: 401 });

    const token = sessionCookie.split("=")[1];
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);
      const userId = payload && payload.id ? String(payload.id) : null;
      if (!userId) return Response.json({ success: false, message: "Invalid session" }, { status: 401 });

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return Response.json({ success: false, message: "User not found" }, { status: 404 });

      const safeUser = {
        id: user.id,
        email: user.email,
        fname: user.fname,
        lname: user.lname,
        role: user.role,
        departmentCode: user.departmentCode,
        branch: user.branch,
      };

      return Response.json({ success: true, data: safeUser });
    } catch (err) {
      console.error("me route jwt verify failed:", err);
      return Response.json({ success: false, message: "Invalid session" }, { status: 401 });
    }
  } catch (error) {
    console.error("Error in /api/auth/me:", error);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
