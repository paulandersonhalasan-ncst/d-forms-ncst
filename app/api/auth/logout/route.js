// app/api/auth/logout/route.js
import { jwtVerify } from "jose";
import { logActivity } from "../../../lib/logger";

export async function DELETE(request) {
  try {
    // try to extract user info from HttpOnly session cookie for logging
    try {
      const cookieHeader = request.headers.get("cookie") || "";
      const cookieParts = cookieHeader.split(";").map((c) => c.trim());
      const sessionCookie = cookieParts.find((c) => c.startsWith("session_token="));
      if (sessionCookie) {
        const token = sessionCookie.split("=")[1];
        try {
          const secret = new TextEncoder().encode(process.env.JWT_SECRET);
          const { payload } = await jwtVerify(token, secret);
          await logActivity({ req: request, userId: payload?.id ? String(payload.id) : null, email: payload?.email || null, action: "LOGOUT", details: null });
        } catch (err) {
          console.error("Failed to verify session token for logout log:", err);
        }
      }
    } catch (err) {
      console.error("Failed to log logout activity:", err);
    }

    const response = Response.json({ success: true, message: "Logged out" }, { status: 200 });
    response.headers.append(
      "Set-Cookie",
      `session_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
    );
    response.headers.append("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.headers.append("Pragma", "no-cache");
    response.headers.append("Expires", "0");
    
    return response;
  } catch (error) {
    console.error("Logout Error in route:", error);
    return Response.json({ success: false, error: "Logout failed" }, { status: 500 });
  }
}
