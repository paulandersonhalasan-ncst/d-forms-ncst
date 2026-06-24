import { NextResponse } from "next/server";
import { prisma } from "../../../prisma/prisma"; // Siguraduhing tama ang daan sa prisma mo

export async function POST() {
  try {
    // 1. I-clear muna natin ang mga lumang test notifications para malinis (Opsyonal)
    // await prisma.notification.deleteMany({});

    // 2. Kuhanin natin ang mga Users mula sa DB gamit ang mga tinukoy mong email
    const accountingStaff = await prisma.user.findUnique({ where: { email: 'accountingstaff' } });
    const accountingHead = await prisma.user.findUnique({ where: { email: 'accountinghead' } });
    const acadHead = await prisma.user.findUnique({ where: { email: 'acadheadness' } });
    const superUser = await prisma.user.findUnique({ where: { email: 'super' } });
    const genedHead = await prisma.user.findUnique({ where: { email: 'genedhead' } });
    const staff = await prisma.user.findUnique({ where: { email: 'staff' } });
    const staff2 = await prisma.user.findUnique({ where: { email: 'staff2' } });
    const dh = await prisma.user.findUnique({ where: { email: 'dh' } });

    // 🛠️ SEED DATA BLOCK
    const newNotifications = [];

    newNotifications.push(
  // === MGA BAGONG UNREAD ALERTS (Mapusyaw na Asul ang Background) ===
  {
    title: 'Memo Returned for Correction',
    message: 'Your IOM Ref: AC-2026-102 was returned by the Budget Office. Reason: Lack of supporting canvass sheets.',
    isRead: false,
    recipientId: accountingStaff.id,
    senderId: accountingHead.id,
  },
  {
    title: 'Urgent: VPAA Signature Required',
    message: 'The Vice President for Academic Affairs requested your immediate endorsement on Ref: ACAD-2026-401.',
    isRead: false,
    recipientId: acadHead.id,
    senderId: superUser.id, // Ginawang representative sender
  },
  {
    title: 'New Overtime Request filed',
    message: 'Staff Ferdinand Romualdez filed an OT request for the upcoming NCST Enrollment Week. Ref: SHS-2026-991.',
    isRead: false,
    recipientId: dh.id,
    senderId: staff2.id,
  },
  {
    title: 'Action Required: Faculty Load Approval',
    message: 'A new curriculum loading sheet with Ref: GE-2026-712 is waiting for your department sign-off.',
    isRead: false,
    recipientId: genedHead.id,
    senderId: staff.id,
  },
  {
    title: 'Security Advisory: Session Expired',
    message: 'Your login session token was refreshed due to an IP address change. No action needed.',
    isRead: false,
    recipientId: staff.id,
    senderId: superUser.id,
  },

  // === MGA READ NOTIFICATIONS (Transparent/History) ===
  {
    title: 'Memo Fully Approved',
    message: 'Your request for Laboratory Supplies Ref: IT-2026-090 has been signed by the Campus Director.',
    isRead: true,
    recipientId: staff2.id,
    senderId: dh.id,
  },
  {
    title: 'Purchase Request Approved',
    message: 'Procurement processed your request Ref: AC-2026-050. Items are now ready for bidding/canvass.',
    isRead: true,
    recipientId: accountingStaff.id,
    senderId: accountingHead.id,
  },
  {
    title: 'Clearance Signed Successfully',
    message: 'Your mid-year clearance tracking Ref: GE-2026-022 has been cleared by the Human Resources Department Head.',
    isRead: true,
    recipientId: staff.id,
    senderId: genedHead.id,
  },
  {
    title: 'System Update Completed',
    message: 'E-IOM NCST Platform successfully upgraded to version 2.4.1. Cached forms were cleared.',
    isRead: true,
    recipientId: acadHead.id,
    senderId: superUser.id,
  },
  {
    title: 'Memo Disapproved / Returned',
    message: 'Event Proposal with Ref: SHS-2026-008 was denied due to conflicting schedules with the Institutional Exam.',
    isRead: true,
    recipientId: staff2.id,
    senderId: dh.id,
  }
);

    // 3. Isaksak na sa Database gamit ang Prisma createMany
    if (newNotifications.length > 0) {
      await prisma.notification.createMany({
        data: newNotifications,
      });
    } else {
      return NextResponse.json({ 
        error: "Walang nahanap na tugmang emails sa database mo. Pakicheck kung tama ang spelling sa User table." 
      }, { status: 400 });
    }

    return NextResponse.json({ message: `Successfully seeded ${newNotifications.length} notifications!` }, { status: 201 });

  } catch (error) {
    console.error("SEEDING ERROR:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}