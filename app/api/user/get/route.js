// app/api/user/get/route.js
import { prisma } from "../../../../prisma/prisma";
import { jwtVerify } from "jose";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get("email");

    console.log(searchParams);

    if (userEmail) {
      const user = await prisma.user.findUnique({ where: { email: userEmail } });

      console.log(user);

      if (!user) {
        return Response.json({ success: false, message: "User not found." }, { status: 404 });
      }

      return Response.json({ success: true, data: user });
    }

    // try to read session cookie and exclude the requester from the returned list
    const cookieHeader = request.headers.get("cookie") || "";
    let currentUserId = null;
    if (cookieHeader) {
      try {
        const cookieParts = cookieHeader.split(";").map((c) => c.trim());
        const sessionCookie = cookieParts.find((c) => c.startsWith("session_token="));
        if (sessionCookie) {
          const token = sessionCookie.split("=")[1];
          const secret = new TextEncoder().encode(process.env.JWT_SECRET);
          const { payload } = await jwtVerify(token, secret);
          // payload should contain `id` as set in login route
          currentUserId = payload && payload.id ? String(payload.id) : null;
        }
      } catch (err) {
        console.error("Failed to verify session token:", err);
      }
    }

    // support filtering users in the same department as the current user
    const sameDepartmentFlag = searchParams.get("sameDepartment");
    const roleFilter = searchParams.get("role");

    if (sameDepartmentFlag === "true" && currentUserId) {
      const currentUser = await prisma.user.findUnique({ where: { id: currentUserId } });
      if (!currentUser) {
        return Response.json({ success: false, message: "Current user not found." }, { status: 404 });
      }

      const whereClause = {
        departmentCode: currentUser.departmentCode || null,
        id: { not: currentUserId },
      };

      // if a specific role is requested, include it in the filter
      if (roleFilter) {
        whereClause.role = roleFilter;
      }

      const deptUsers = await prisma.user.findMany({ where: whereClause });
      return Response.json({ success: true, count: deptUsers.length, data: deptUsers });
    }

    // if we have a currentUserId, exclude it from the list
    const allUsers = currentUserId
      ? await prisma.user.findMany({ where: { id: { not: currentUserId } } })
      : await prisma.user.findMany();

    return Response.json({ success: true, count: allUsers.length, data: allUsers });
  } catch (error) {
    console.error("Error sa Hybrid Get User Route:", error);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}