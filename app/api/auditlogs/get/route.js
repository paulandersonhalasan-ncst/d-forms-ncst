import { NextResponse } from "next/server";
// I-import ang prisma client mula sa custom output path na nasa schema mo
import { prisma } from "../../../../prisma/prisma";

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const timeRange =
    searchParams.get("timeRange") || "all";

  const startParam =
    searchParams.get("startDate");

  const endParam =
    searchParams.get("endDate");

  let where = {};

  try {
    const now = new Date();

    if (timeRange === "day") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const end = new Date();
      end.setHours(23, 59, 59, 999);

      where.createdAt = {
        gte: start,
        lte: end,
      };
    }

    else if (timeRange === "week") {
      const start = new Date(now);

      const day = start.getDay();
      const diff =
        start.getDate() -
        day +
        (day === 0 ? -6 : 1);

      start.setDate(diff);
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      where.createdAt = {
        gte: start,
        lte: end,
      };
    }

    else if (timeRange === "month") {
      const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );

      const end = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
      );

      end.setHours(23, 59, 59, 999);

      where.createdAt = {
        gte: start,
        lte: end,
      };
    }

    else if (
      timeRange === "custom" &&
      startParam &&
      endParam
    ) {
      where.createdAt = {
        gte: new Date(
          `${startParam}T00:00:00`
        ),
        lte: new Date(
          `${endParam}T23:59:59.999`
        ),
      };
    }

    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: true,
      },
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