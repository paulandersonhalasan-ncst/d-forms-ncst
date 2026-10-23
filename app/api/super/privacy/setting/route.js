// app/api/privacy/settings/route.js
import { NextResponse } from 'next/server';
import { prisma } from '../../../../../prisma/prisma';
import { jwtVerify } from 'jose';
import { logActivity } from '../../../../lib/logger';
import { put, del } from '@vercel/blob';

async function getAuthenticatedUser(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  if (!cookieHeader) return null;
  const cookieParts = cookieHeader.split(';').map((c) => c.trim());
  const sessionCookie = cookieParts.find((c) => c.startsWith('session_token='));
  if (!sessionCookie) return null;
  const token = sessionCookie.split('=')[1];
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const userId = payload?.id ? String(payload.id) : null;
    if (!userId) return null;
    return await prisma.user.findUnique({ where: { id: userId } });
  } catch {
    return null;
  }
}

// ==========================================
// GET /api/privacy/settings — PUBLIC
// ==========================================
export async function GET() {
  try {
    let settings = await prisma.privacySettings.findUnique({
      where: { id: 'singleton' },
    });

    // Auto-create with defaults if never saved
    if (!settings) {
      settings = await prisma.privacySettings.create({
        data: {
          id: 'singleton',
          noticeText: [
            'The National College of Science and Technology (NCST) is committed to protecting the privacy of all personal data entrusted to us.',
            '',
            'In compliance with the Data Privacy Act of 2012 (Republic Act No. 10173) and its Implementing Rules and Regulations, we collect, process, store, and dispose of personal data only for legitimate educational, administrative, and operational purposes.',
            '',
            'For concerns or requests regarding your personal data (access, correction, deletion, or objection), please contact our Data Protection Officer using the details below.',
          ].join('\n'),
          lastUpdated: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('GET Privacy Settings Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch privacy settings' },
      { status: 500 }
    );
  }
}

// ==========================================
// PUT /api/privacy/settings — SuperUser only
// ==========================================
export async function PUT(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'SuperUser') {
      return NextResponse.json(
        { success: false, message: 'Only SuperUser can edit privacy settings' },
        { status: 403 }
      );
    }

    const formData = await request.formData();

    const noticeText        = formData.get('noticeText') || null;
    const dpoRegistrationNo = formData.get('dpoRegistrationNo') || null;
    const dpoOfficerName    = formData.get('dpoOfficerName') || null;
    const dpoContactEmail   = formData.get('dpoContactEmail') || null;
    const dpoContactPhone   = formData.get('dpoContactPhone') || null;
    const dpoOfficeAddress  = formData.get('dpoOfficeAddress') || null;
    const lastUpdatedRaw    = formData.get('lastUpdated') || null;
    const keepBadge         = formData.get('keepBadge') === 'true';
    const badgeFile         = formData.get('badge');

    const lastUpdated = lastUpdatedRaw ? new Date(lastUpdatedRaw) : new Date();

    // Get current settings for badge diff
    const current = await prisma.privacySettings.findUnique({
      where: { id: 'singleton' },
    });

    // Resolve new badge URL
    let finalBadgeUrl = current?.dpoBadgeUrl || null;

    if (badgeFile && badgeFile.size > 0) {
      // Upload new badge
      const cleanFilename = `privacy/npc-badge-${Date.now()}-${badgeFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
      const blob = await put(cleanFilename, badgeFile, {
        access: 'public',
        addRandomSuffix: true,
        token: process.env.DMSBLOB_READ_WRITE_TOKEN,
        storeId: process.env.DMSBLOB_STORE_ID,
      });
      finalBadgeUrl = blob.url;
    } else if (!keepBadge) {
      // Explicitly cleared
      finalBadgeUrl = null;
    }

    // Save
    const updated = await prisma.privacySettings.upsert({
      where: { id: 'singleton' },
      update: {
        dpoBadgeUrl: finalBadgeUrl,
        dpoRegistrationNo,
        dpoOfficerName,
        dpoContactEmail,
        dpoContactPhone,
        dpoOfficeAddress,
        noticeText,
        lastUpdated,
        updatedById: user.id,
        updatedByName: `${user.fname} ${user.lname}`,
      },
      create: {
        id: 'singleton',
        dpoBadgeUrl: finalBadgeUrl,
        dpoRegistrationNo,
        dpoOfficerName,
        dpoContactEmail,
        dpoContactPhone,
        dpoOfficeAddress,
        noticeText,
        lastUpdated,
        updatedById: user.id,
        updatedByName: `${user.fname} ${user.lname}`,
      },
    });

    // Cleanup old badge blob if it was replaced or removed
    const oldUrl = current?.dpoBadgeUrl;
    if (oldUrl && oldUrl !== finalBadgeUrl) {
      try {
        await del(oldUrl);
      } catch (delErr) {
        console.error('Old badge blob cleanup error:', delErr);
      }
    }

    await logActivity({
      req: request,
      userId: user.id,
      email: user.email,
      action: 'PRIVACY_SETTINGS_UPDATE',
      details: JSON.stringify({
        badgeChanged: oldUrl !== finalBadgeUrl,
        noticeTextLength: noticeText?.length ?? 0,
      }),
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('PUT Privacy Settings Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to save privacy settings' },
      { status: 500 }
    );
  }
}