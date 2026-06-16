import { NextResponse } from "next/server";
// I-import ang prisma client mula sa custom output path na nasa schema mo
import { prisma } from "../../../../prisma/prisma";

export async function GET() {
  try {
    // Kunin ang lahat ng logs mula sa ActivityLog table
    const logs = await prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: true // <--- Ito lang ang kailangan para awtomatikong lumabas ang fname, lname, branch, at role!
      }
    });

    // Ibalik ang matagumpay na response bitbit ang 'data' array
    return NextResponse.json({
      success: true,
      data: logs,
    });

  } catch (error) {
    console.error("CRITICAL: Failed to fetch audit logs:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Internal Server Error. Hindi makuha ang audit logs.",
      },
      { status: 500 }
    );
  }
}