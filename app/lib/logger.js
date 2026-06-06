// lib/logger.js o prisma/prisma.js
import { prisma } from "../../prisma/prisma";
export async function logActivity({ req, userId, email, action, details }) {
  try {
    // Subukang kunin ang IP Address mula sa request headers (Next.js standard)
    const ipAddress = req 
      ? req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") 
      : null;

    await prisma.activityLog.create({
      data: {
        userId: userId || null,
        email: email || null,
        action: action,
        details: details || null,
        ipAddress: ipAddress,
      },
    });
  } catch (error) {
    // Console error lang para hindi ma-crash ang main API mo kung sakaling magka-error ang logging
    console.error("CRITICAL: Failed to write activity log:", error);
  }
}