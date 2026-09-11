import { NextResponse } from 'next/server';
import { prisma } from "../../../prisma/prisma";
import { jwtVerify } from "jose";

async function getAuthenticatedUser(request) {
  const cookieHeader = request.headers.get("cookie") || "";
  if (!cookieHeader) return null;

  const cookieParts = cookieHeader.split(";").map((c) => c.trim());
  const sessionCookie = cookieParts.find((c) => c.startsWith("session_token="));
  if (!sessionCookie) return null;

  const token = sessionCookie.split("=")[1];
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const userId = payload && payload.id ? String(payload.id) : null;
    if (!userId) return null;
    return await prisma.user.findUnique({ where: { id: userId } });
  } catch (err) {
    console.error("JWT Session verification broken:", err);
    return null;
  }
}

function getWeekRange(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getMonthRange(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getDayRange(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function GET(request) {
  try {
    const authenticatedUser = await getAuthenticatedUser(request);
    if (!authenticatedUser) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    const url = new URL(request.url);
    let departmentCode = url.searchParams.get('departmentCode');
    const timeRange = url.searchParams.get('timeRange') || 'day';
    const now = new Date();
    const dateParam =
      url.searchParams.get('date') ||
      `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, '0')}-${String(
        now.getDate()
      ).padStart(2, '0')}`;

    const userRole = authenticatedUser.role;
    const userDept = authenticatedUser.departmentCode;

    if (!departmentCode || departmentCode.trim() === '') {
      departmentCode = userDept;
    }

    const isAdminOrSuper = ['Admin', 'SuperUser'].includes(userRole);
    let targetDept = departmentCode;
    if (!isAdminOrSuper) {
      targetDept = userDept;
    }

    // --- ✅ UPDATED: Date range logic with custom support ---
    let startDate, endDate;

    if (timeRange === 'all') {
      startDate = new Date(0);
      endDate = new Date();
    } else if (timeRange === 'custom') {
      const startParam = url.searchParams.get('startDate');
      const endParam = url.searchParams.get('endDate');

      if (startParam && endParam) {
        startDate = new Date(`${startParam}T00:00:00`);
        endDate = new Date(`${endParam}T23:59:59.999`);
      } else {
        // Fallback: gamitin ang kasalukuyang buwan
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
      }
    } else {
      const baseDate = new Date(dateParam);
      if (timeRange === 'day') {
        ({ start: startDate, end: endDate } = getDayRange(baseDate));
      } else if (timeRange === 'week') {
        ({ start: startDate, end: endDate } = getWeekRange(baseDate));
      } else if (timeRange === 'month') {
        ({ start: startDate, end: endDate } = getMonthRange(baseDate));
      } else {
        ({ start: startDate, end: endDate } = getWeekRange(baseDate));
      }
    }

    const totalSent = await prisma.memo.count({
      where: {
        senderDept: targetDept,
        status: 'APPROVED',
        createdAt: { gte: startDate, lte: endDate }
      }
    });

    const totalReceived = await prisma.memoRecipientStatus.count({
      where: {
        departmentName: targetDept,
        memo: {
          status: 'APPROVED',
          createdAt: { gte: startDate, lte: endDate }
        }
      }
    });

    const active = await prisma.memo.count({
      where: {
        senderDept: targetDept,
        status: { not: 'CLOSED' },
        createdAt: { gte: startDate, lte: endDate }
      }
    });

    // --- 2. Status Distribution ---
    const statusGroups = await prisma.memo.groupBy({
      by: ['status'],
      where: {
        senderDept: targetDept,
        createdAt: { gte: startDate, lte: endDate }
      },
      _count: true
    });
    const statusDistribution = statusGroups.reduce((acc, g) => {
      acc[g.status] = g._count;
      return acc;
    }, {});

    // --- 3. Priority Distribution ---
    const priorityGroups = await prisma.memo.groupBy({
      by: ['priority'],
      where: {
        senderDept: targetDept,
        createdAt: { gte: startDate, lte: endDate }
      },
      _count: true
    });
    const priorityDistribution = priorityGroups.reduce((acc, g) => {
      acc[g.priority] = g._count;
      return acc;
    }, {});

    // --- 4. Purpose Distribution ---
    const purposeGroups = await prisma.memo.groupBy({
      by: ['purpose'],
      where: {
        senderDept: targetDept,
        createdAt: { gte: startDate, lte: endDate }
      },
      _count: true
    });
    const purposeDistribution = purposeGroups.reduce((acc, g) => {
      acc[g.purpose] = g._count;
      return acc;
    }, {});

    // --- 5. Trends ---
    const allMemos = await prisma.memo.findMany({
      where: {
        senderDept: targetDept,
        status: 'APPROVED',
        createdAt: { gte: startDate, lte: endDate }
      },
      select: { createdAt: true }
    });

    const trendMap = new Map();

    if (timeRange === 'day') {
      // Initialize all 24 hours
      for (let i = 0; i < 24; i++) {
        const hourLabel = new Date(
          2000,
          0,
          1,
          i
        ).toLocaleTimeString('en-US', {
          hour: 'numeric',
          hour12: true,
        });

        trendMap.set(hourLabel, 0);
      }

      allMemos.forEach((memo) => {
        const hourLabel = memo.createdAt.toLocaleTimeString(
          'en-US',
          {
            hour: 'numeric',
            hour12: true,
          }
        );

        trendMap.set(
          hourLabel,
          (trendMap.get(hourLabel) || 0) + 1
        );
      });
    } else if (timeRange === 'all') {
      allMemos.forEach((memo) => {
        const monthKey = memo.createdAt.toLocaleDateString(
          'en-CA',
          {
            year: 'numeric',
            month: '2-digit',
          }
        );

        trendMap.set(
          monthKey,
          (trendMap.get(monthKey) || 0) + 1
        );
      });
    } else {
      allMemos.forEach((memo) => {
        const dateKey = memo.createdAt
          .toLocaleDateString('en-CA');

        trendMap.set(
          dateKey,
          (trendMap.get(dateKey) || 0) + 1
        );
      });
    }

    allMemos.forEach(memo => {
      const dateKey = memo.createdAt
        .toISOString()
        .split('T')[0];

      trendMap.set(
        dateKey,
        (trendMap.get(dateKey) || 0) + 1
      );
    });
    
    let trendData;

    if (timeRange === 'day') {
      trendData = Array.from(
        trendMap.entries()
      ).map(([date, count]) => ({
        date,
        count,
      }));
    } else {
      trendData = Array.from(
        trendMap.entries()
      )
        .map(([date, count]) => ({
          date,
          count,
        }))
        .sort((a, b) =>
          a.date.localeCompare(b.date)
        );
    }

    // --- 6. Top Senders ---
    const recipientRecords = await prisma.memoRecipientStatus.findMany({
      where: {
        departmentName: targetDept,
        memo: {
          status: 'APPROVED',
          createdAt: { gte: startDate, lte: endDate }
        }
      },
      include: {
        memo: { select: { senderDept: true } }
      }
    });

    const senderMap = new Map();
    recipientRecords.forEach(record => {
      const sender = record.memo.senderDept;
      senderMap.set(sender, (senderMap.get(sender) || 0) + 1);
    });
    const senderData = Array.from(senderMap.entries())
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // --- 7. Top Recipients ---
    const outgoingMemos = await prisma.memo.findMany({
      where: {
        senderDept: targetDept,
        status: 'APPROVED',
        createdAt: { gte: startDate, lte: endDate }
      },
      include: {
        recipients: { select: { departmentName: true } }
      }
    });

    const resolved = await prisma.memoRecipientStatus.count({
      where: {
        departmentName: targetDept,
        status: { in: ['COMPLETED', 'CLOSED', 'DENIED'] },
        OR: [
          { completedAt: { gte: startDate, lte: endDate } },
          { closedAt: { gte: startDate, lte: endDate } },
          { deniedAt: { gte: startDate, lte: endDate } },
        ],
      },
    });

    console.log("DEBUG RESOLVED COUNT : ", resolved);

    const recipientMap = new Map();
    outgoingMemos.forEach(memo => {
      memo.recipients.forEach(recipient => {
        const dept = recipient.departmentName;
        recipientMap.set(dept, (recipientMap.get(dept) || 0) + 1);
      });
    });
    const recipientData = Array.from(recipientMap.entries())
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // --- 8. Average Processing Time ---
    const closedMemos = await prisma.memo.findMany({
      where: {
        senderDept: targetDept,
        status: 'CLOSED',
        createdAt: { gte: startDate, lte: endDate }
      },
      select: { createdAt: true, lastActivityAt: true }
    });

    let totalDays = 0;
    let closedCount = 0;
    closedMemos.forEach(memo => {
      const diffMs = memo.lastActivityAt.getTime() - memo.createdAt.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      totalDays += diffDays;
      closedCount++;
    });
    const averageProcessingTime = closedCount > 0 ? Math.round((totalDays / closedCount) * 10) / 10 : 0;

    

        // ============================================
        // FRF ANALYTICS
        // ============================================

        const frfBaseWhere = {
          createdAt: { gte: startDate, lte: endDate },
        };

        // Total FRF involving this department (as requestor OR as approver)
        const frfTotal = await prisma.facilityReservation.count({
          where: {
            ...frfBaseWhere,
            OR: [
              { requestorDept: targetDept },
              { approvals: { some: { departmentCode: targetDept } } },
            ],
          },
        });

        // For Approval – pending for this department
        const frfForApproval = await prisma.facilityReservation.count({
          where: {
            ...frfBaseWhere,
            status: { in: ['PENDING_APPROVAL', 'RESCHEDULE_PENDING'] },
            approvals: {
              some: { departmentCode: targetDept, status: 'PENDING' },
            },
          },
        });

        // Incoming – requests from OTHER departments where our dept has approval
        const frfIncoming = await prisma.facilityReservation.count({
          where: {
            ...frfBaseWhere,
            NOT: { requestorDept: targetDept },
            approvals: { some: { departmentCode: targetDept } },
          },
        });

        // Outgoing – requests made BY this department
        const frfOutgoing = await prisma.facilityReservation.count({
          where: {
            ...frfBaseWhere,
            requestorDept: targetDept,
          },
        });

        // Approved by this department
        const frfApproved = await prisma.facilityReservation.count({
          where: {
            ...frfBaseWhere,
            approvals: {
              some: { departmentCode: targetDept, status: 'APPROVED' },
            },
          },
        });

        // Completed
        const frfCompleted = await prisma.facilityReservation.count({
          where: {
            ...frfBaseWhere,
            status: 'COMPLETED',
            OR: [
              { requestorDept: targetDept },
              { approvals: { some: { departmentCode: targetDept } } },
            ],
          },
        });

        // Rejected
        const frfRejected = await prisma.facilityReservation.count({
          where: {
            ...frfBaseWhere,
            status: 'REJECTED',
            OR: [
              { requestorDept: targetDept },
              { approvals: { some: { departmentCode: targetDept } } },
            ],
          },
        });

        // Revision Requested
        const frfRevision = await prisma.facilityReservation.count({
          where: {
            ...frfBaseWhere,
            status: 'REVISION_REQUESTED',
            approvals: { some: { departmentCode: targetDept } },
          },
        });

        // ---- FRF Status Distribution ----
        const frfStatusGroups = await prisma.facilityReservation.groupBy({
          by: ['status'],
          where: {
            ...frfBaseWhere,
            OR: [
              { requestorDept: targetDept },
              { approvals: { some: { departmentCode: targetDept } } },
            ],
          },
          _count: true,
        });
        const frfStatusDistribution = frfStatusGroups.reduce((acc, g) => {
          acc[g.status] = g._count;
          return acc;
        }, {});

        // ---- FRF Type Distribution ----
        const frfTypeGroups = await prisma.facilityReservation.groupBy({
          by: ['type'],
          where: {
            ...frfBaseWhere,
            requestorDept: targetDept,
          },
          _count: true,
        });
        const frfTypeDistribution = frfTypeGroups.reduce((acc, g) => {
          acc[g.type] = g._count;
          return acc;
        }, {});

        // ---- FRF Top Venues ----
        const frfDates = await prisma.facilityReservationDate.findMany({
          where: {
            reservation: {
              ...frfBaseWhere,
              requestorDept: targetDept,
            },
          },
          include: { place: { select: { name: true } } },
        });
        const venueMap = new Map();
        frfDates.forEach((d) => {
          const name = d.place?.name || d.placeOther || 'Unknown';
          venueMap.set(name, (venueMap.get(name) || 0) + 1);
        });
        const frfTopVenues = Array.from(venueMap.entries())
          .map(([venue, count]) => ({ venue, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // ---- FRF Top Equipment ----
        const frfEquipment = await prisma.facilityEquipmentRequest.findMany({
          where: {
            reservation: {
              ...frfBaseWhere,
              requestorDept: targetDept,
            },
          },
          include: { equipment: { select: { name: true } } },
        });
        const eqMap = new Map();
        frfEquipment.forEach((e) => {
          const name = e.equipment?.name || 'Unknown';
          eqMap.set(name, (eqMap.get(name) || 0) + e.quantityRequested);
        });
        const frfTopEquipment = Array.from(eqMap.entries())
          .map(([equipment, count]) => ({ equipment, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // ---- FRF Trends ----
        const frfMemos = await prisma.facilityReservation.findMany({
          where: {
            ...frfBaseWhere,
            OR: [
              { requestorDept: targetDept },
              { approvals: { some: { departmentCode: targetDept } } },
            ],
          },
          select: { createdAt: true },
        });

        const frfTrendMap = new Map();
        if (timeRange === 'day') {
          for (let i = 0; i < 24; i++) {
            const hourLabel = new Date(2000, 0, 1, i).toLocaleTimeString('en-US', {
              hour: 'numeric',
              hour12: true,
            });
            frfTrendMap.set(hourLabel, 0);
          }
          frfMemos.forEach((m) => {
            const hourLabel = m.createdAt.toLocaleTimeString('en-US', {
              hour: 'numeric',
              hour12: true,
            });
            frfTrendMap.set(hourLabel, (frfTrendMap.get(hourLabel) || 0) + 1);
          });
        } else {
          frfMemos.forEach((m) => {
            const dateKey = m.createdAt.toLocaleDateString('en-CA');
            frfTrendMap.set(dateKey, (frfTrendMap.get(dateKey) || 0) + 1);
          });
        }

        const frfTrends =
          timeRange === 'day'
            ? Array.from(frfTrendMap.entries()).map(([date, count]) => ({ date, count }))
            : Array.from(frfTrendMap.entries())
                .map(([date, count]) => ({ date, count }))
                .sort((a, b) => a.date.localeCompare(b.date));

        // ---- FRF Average Processing Time ----
        const frfCompletedList = await prisma.facilityReservation.findMany({
          where: {
            ...frfBaseWhere,
            status: 'COMPLETED',
            requestorDept: targetDept,
          },
          select: { createdAt: true, updatedAt: true },
        });
        let frfTotalDays = 0;
        let frfCount = 0;
        frfCompletedList.forEach((r) => {
          const diffMs = r.updatedAt.getTime() - r.createdAt.getTime();
          frfTotalDays += diffMs / (1000 * 60 * 60 * 24);
          frfCount++;
        });
        const frfAverageProcessingTime =
          frfCount > 0 ? Math.round((frfTotalDays / frfCount) * 10) / 10 : 0;

        // ============================================
        // RETURN RESPONSE
        // ============================================
        return NextResponse.json({
          success: true,
          data: {
            // ---- IOM Analytics ----
            overview: {
              total: totalSent,
              sent: totalSent,
              received: totalReceived,
              active: active,
              resolved: resolved,
            },
            statusDistribution,
            priorityDistribution,
            purposeDistribution,
            trends: trendData,
            topSenders: senderData,
            topRecipients: recipientData,
            averageProcessingTime,

            // ---- FRF Analytics ----
            frf: {
              overview: {
                total: frfTotal,
                forApproval: frfForApproval,
                incoming: frfIncoming,
                outgoing: frfOutgoing,
                approved: frfApproved,
                completed: frfCompleted,
                rejected: frfRejected,
                revision: frfRevision,
              },
              statusDistribution: frfStatusDistribution,
              typeDistribution: frfTypeDistribution,
              topVenues: frfTopVenues,
              topEquipment: frfTopEquipment,
              trends: frfTrends,
              averageProcessingTime: frfAverageProcessingTime,
            },
          },
        });

  } catch (error) {
    console.error("Analytics API Error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}