// lib/frf_pdf.js
import PDFDocument from 'pdfkit';

export function generateFRFPdfBuffer(reservation) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true,
        info: {
          Title: `FRF ${reservation.referenceId || ''}`,
          Author: 'NCST D-Forms',
        },
      });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── Layout constants ──────────────────────────────────────
      const M = 40;
      const PW = doc.page.width;
      const CW = PW - M * 2;
      let y = M;

      const COL = {
        text: '#000000',
        muted: '#666666',
        border: '#cccccc',
        borderDark: '#000000',
        cardBg: '#f8f9fa',
        cardAccent: '#010203',
        noteBg: '#f8f9fa',
        noteAccent: '#585858',
        reschedBg: '#fff8e1',
        reschedAccent: '#ffc107',
        packUpBg: '#f3f5f3',
        packUpBorder: '#888888',
      };

      const STATUS = {
        APPROVED: { bg: '#d4edda', fg: '#155724' },
        ACKNOWLEDGED_NOTED: { bg: '#d1ecf1', fg: '#0c5460' },
        ACKNOWLEDGED: { bg: '#cce5ff', fg: '#004085' },
        REJECTED: { bg: '#f8d7da', fg: '#721c24' },
        REVISION_REQUESTED: { bg: '#fff3cd', fg: '#856404' },
        PENDING: { bg: '#e9ecef', fg: '#383d41' },
      };

      // ── Formatters ────────────────────────────────────────────
      const fmtDate = (v) => v
        ? new Date(v).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' })
        : '—';
      const fmtTime = (v) => v
        ? new Date(v).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true })
        : '—';
      const fmtDT = (v) => v
        ? new Date(v).toLocaleString('en-US', { timeZone: 'Asia/Manila' })
        : '—';

      const ensureSpace = (need) => {
        if (y + need > doc.page.height - M - 20) {
          doc.addPage();
          y = M;
        }
      };

      const drawBadge = (label, x, yPos, colors) => {
        const fs = 7, px = 5, py = 2;
        doc.fontSize(fs).font('Helvetica-Bold');
        const tw = doc.widthOfString(label) + px * 2;
        const th = fs + py * 2 + 2;
        doc.roundedRect(x, yPos, tw, th, 2).fill(colors.bg);
        doc.fillColor(colors.fg).fontSize(fs).font('Helvetica-Bold')
          .text(label, x + px, yPos + py, { lineBreak: false });
      };

      const drawSectionTitle = (title) => {
        ensureSpace(30);
        doc.moveTo(M, y).lineTo(M + CW, y).lineWidth(0.8).strokeColor(COL.border).stroke();
        y += 10;
        doc.fontSize(11).font('Helvetica-Bold').fillColor(COL.text)
          .text(title, M, y);
        const tw = doc.widthOfString(title);
        y = doc.y + 1;
        doc.moveTo(M, y).lineTo(M + tw, y).lineWidth(1).strokeColor(COL.text).stroke();
        y += 5;
      };

      // ── Header ────────────────────────────────────────────────
      doc.fontSize(18).font('Helvetica-Bold').fillColor(COL.borderDark)
        .text('NCST D-FORMS', { align: 'center' });
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#333333')
        .text('FACILITY RESERVATION FORM (FRF)', { align: 'center' });
      y = doc.y + 8;
      doc.moveTo(M, y).lineTo(M + CW, y).lineWidth(2).strokeColor(COL.borderDark).stroke();
      y += 8;
      doc.fontSize(9).font('Helvetica').fillColor('#090808')
        .text(`${reservation.referenceId || 'N/A'}  ·  ${fmtDT(reservation.createdAt)}`, { align: 'center' });
      y = doc.y + 6;

      if (reservation.isReschedule) {
        const label = 'RESCHEDULE REQUEST';
        doc.fontSize(8).font('Helvetica-Bold');
        const tw = doc.widthOfString(label) + 24;
        const bx = (PW - tw) / 2;
        doc.roundedRect(bx, y, tw, 16, 8).fill(COL.reschedAccent);
        doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold')
          .text(label, bx, y + 4, { width: tw, align: 'center' });
        y += 24;
      }

      // ── Meta grid ─────────────────────────────────────────────
      const venuesMap = new Map();
      (reservation.dates || []).forEach((d) => {
        const n = (d.place?.name || d.placeOther || 'TBA').trim();
        venuesMap.set(n.toLowerCase(), n);
      });
      const venuesStr = Array.from(venuesMap.values()).join(', ') || '—';

      const metaItems = [
        ['Status', reservation.status || '—'],
        ['Type', (reservation.type || '—').replace(/_/g, ' ')],
        ['Event Title', reservation.eventName || '—'],
        ['Requestor', `${reservation.requestor?.fname || ''} ${reservation.requestor?.lname || ''}`.trim() || '—'],
        ['Department', reservation.requestorDept || '—'],
        ['Attendees', String(reservation.attendeesCount ?? '—')],
        ['Venue/s', venuesStr],
        ['Usage Hours', String(reservation.usageHours ?? '—')],
        ['With Charge', reservation.withCharge ? 'Yes' : 'No'],
      ];

      const half = Math.ceil(metaItems.length / 2);
      const leftCol = metaItems.slice(0, half);
      const rightCol = metaItems.slice(half);
      const colW = (CW - 16) / 2;
      const valW = colW - 100;

      doc.fontSize(8.5).font('Helvetica');
      let lh = 0, rh = 0;
      leftCol.forEach(([_, v]) => {
        lh += Math.max(14, doc.heightOfString(String(v), { width: valW }) + 4);
      });
      rightCol.forEach(([_, v]) => {
        rh += Math.max(14, doc.heightOfString(String(v), { width: valW }) + 4);
      });
      const boxH = Math.max(lh, rh) + 16;

      ensureSpace(boxH + 10);
      const boxY = y;
      doc.rect(M, boxY, CW, boxH).lineWidth(0.8).strokeColor(COL.border).stroke();

      let cursorY = boxY + 8;
      leftCol.forEach(([label, value]) => {
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#333333')
          .text(`${label}:`, M + 8, cursorY, { width: 88, lineBreak: false });
        doc.fontSize(8.5).font('Helvetica').fillColor(COL.text)
          .text(String(value), M + 100, cursorY, { width: valW });
        const vh = Math.max(14, doc.heightOfString(String(value), { width: valW }) + 4);
        cursorY += vh;
      });

      cursorY = boxY + 8;
      rightCol.forEach(([label, value]) => {
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#333333')
          .text(`${label}:`, M + CW / 2 + 8, cursorY, { width: 88, lineBreak: false });
        doc.fontSize(8.5).font('Helvetica').fillColor(COL.text)
          .text(String(value), M + CW / 2 + 100, cursorY, { width: valW });
        const vh = Math.max(14, doc.heightOfString(String(value), { width: valW }) + 4);
        cursorY += vh;
      });

      y = boxY + boxH + 10;

      // ── Requestor Notes ───────────────────────────────────────
      if (reservation.requestorNotes) {
        ensureSpace(60);
        doc.fontSize(10).font('Helvetica-Bold').fillColor(COL.text)
          .text(reservation.isReschedule ? 'Reschedule Reason' : 'Requestor Notes', M, y);
        y = doc.y + 4;

        doc.fontSize(9).font('Helvetica');
        const noteW = CW - 20;
        const noteH = doc.heightOfString(reservation.requestorNotes, { width: noteW }) + 16;
        ensureSpace(noteH + 10);
        doc.rect(M + 4, y, CW - 4, noteH).fill(COL.noteBg);
        doc.rect(M, y, 4, noteH).fill(COL.noteAccent);
        doc.fillColor(COL.text).fontSize(9).font('Helvetica')
          .text(reservation.requestorNotes, M + 14, y + 8, { width: noteW });
        y += noteH + 10;
      }

      // ── Date card renderer ────────────────────────────────────
      const drawDateCard = (d, index, variant = 'normal') => {
        const cardH = 46;
        ensureSpace(cardH + 6);
        const cy = y;
        const bg = variant === 'reschedule' ? COL.reschedBg : COL.cardBg;
        const accent = variant === 'reschedule' ? COL.reschedAccent : COL.cardAccent;
        const dateVal = d.date || d.eventStart;
        const placeName = (typeof d.place === 'object' && d.place && 'name' in d.place)
          ? d.place.name
          : (d.placeOther || d.place?.name || '—');

        doc.rect(M + 4, cy, CW - 4, cardH).fill(bg);
        doc.rect(M, cy, 4, cardH).fill(accent);
        doc.fontSize(9).font('Helvetica-Bold').fillColor(COL.text)
          .text(`Date ${index + 1}: ${fmtDate(dateVal)}`, M + 14, cy + 6);
        doc.fontSize(8).font('Helvetica').fillColor('#333333')
          .text(
            `Setup: ${fmtTime(d.setupTime)}  •  Event: ${fmtTime(d.eventStart)} – ${fmtTime(d.eventEnd)}  •  Pack-up: ${fmtTime(d.teardownTime)}`,
            M + 14, cy + 22, { width: CW - 24 }
          );
        doc.fontSize(8).font('Helvetica').fillColor('#333333')
          .text(`Place: ${placeName}`, M + 14, cy + 34, { width: CW - 24 });
        y = cy + cardH + 4;
      };

      // ── Original Dates (reschedule only) ──────────────────────
      if (reservation.isReschedule && Array.isArray(reservation.originalDates) && reservation.originalDates.length > 0) {
        drawSectionTitle('Original Dates');
        reservation.originalDates.forEach((d, i) => drawDateCard(d, i, 'reschedule'));
        y += 4;
      }

      // ── Event Dates ───────────────────────────────────────────
      drawSectionTitle(reservation.isReschedule ? 'New Event Dates' : 'Event Dates');
      (reservation.dates || []).forEach((d, i) => drawDateCard(d, i));
      y += 4;

      // ── Table helper ──────────────────────────────────────────
      const drawTable = (columns, rows) => {
        ensureSpace(30);
        const headerY = y;
        doc.fontSize(8).font('Helvetica-Bold').fillColor(COL.text);
        let cx = M;
        columns.forEach((col) => {
          doc.text(col.label, cx + 4, headerY + 4, {
            width: col.width - 8,
            align: col.align || 'left',
          });
          cx += col.width;
        });
        y = headerY + 18;
        doc.moveTo(M, y).lineTo(M + CW, y).lineWidth(1.2).strokeColor(COL.borderDark).stroke();
        y += 2;

        rows.forEach((row) => {
          doc.fontSize(8).font('Helvetica');
          let maxH = 12;
          columns.forEach((col, ci) => {
            const v = String(row.cells[ci] ?? '');
            const h = doc.heightOfString(v, { width: col.width - 8 });
            maxH = Math.max(maxH, h);
          });
          const rowH = maxH + 8;

          ensureSpace(rowH + 4);
          const rowY = y;
          cx = M;
          columns.forEach((col, ci) => {
            const v = String(row.cells[ci] ?? '');
            if (col.badge) {
              const colors = STATUS[row.statusKey] || STATUS.PENDING;
              drawBadge(v, cx + 4, rowY + 5, colors);
            } else {
              doc.fontSize(8).font('Helvetica').fillColor(COL.text)
                .text(v, cx + 4, rowY + 4, { width: col.width - 8, align: col.align || 'left' });
            }
            cx += col.width;
          });
          y = rowY + rowH;
          doc.moveTo(M, y).lineTo(M + CW, y).lineWidth(0.3).strokeColor(COL.border).stroke();
          y += 2;
        });
        y += 6;
      };

      // ── Equipment ─────────────────────────────────────────────
      drawSectionTitle('Equipment Requested');
      if ((reservation.equipmentRequests || []).length === 0) {
        doc.fontSize(9).font('Helvetica-Oblique').fillColor(COL.muted)
          .text('No equipment requested', M, y);
        y = doc.y + 8;
      } else {
        const eqRows = reservation.equipmentRequests.map((eq) => ({
          cells: [
            eq.equipment?.name || 'Unknown',
            eq.equipment?.departmentCode || '—',
            String(eq.quantityRequested ?? '—'),
          ],
        }));
        drawTable(
          [
            { label: 'Equipment Name', width: CW * 0.55 },
            { label: 'Department', width: CW * 0.25 },
            { label: 'Qty', width: CW * 0.20, align: 'center' },
          ],
          eqRows
        );
      }

      // ── Assignments ───────────────────────────────────────────
      if ((reservation.assignments || []).length > 0) {
        drawSectionTitle('ITO Staff Assignment/s');
        const asnRows = reservation.assignments.map((a) => {
          const dutyLabel =
            a.dutyType === 'TEARDOWN' ? 'Pack-up'
            : a.dutyType === 'SETUP' ? 'Setup'
            : a.dutyType === 'OPERATOR' ? 'Operator'
            : a.dutyType === 'ASSISTANT' ? 'Assistant'
            : a.dutyType;
          return {
            cells: [
              fmtDate(a.dutyStart),
              `${a.user?.fname || ''} ${a.user?.lname || ''}`.trim() || '—',
              dutyLabel,
              a.isOvertime ? 'OT' : '—',
              fmtTime(a.dutyStart),
              fmtTime(a.dutyEnd),
              a.notes || '—',
            ],
          };
        });
        drawTable(
          [
            { label: 'Date', width: CW * 0.16 },
            { label: 'Staff', width: CW * 0.20 },
            { label: 'Duty', width: CW * 0.12 },
            { label: 'OT', width: CW * 0.06, align: 'center' },
            { label: 'Start', width: CW * 0.11 },
            { label: 'End', width: CW * 0.11 },
            { label: 'Notes', width: CW * 0.24 },
          ],
          asnRows
        );
      }

      // ── Approvals ─────────────────────────────────────────────
      const renderApprovals = (approvals, title) => {
        if (!approvals || approvals.length === 0) return;
        drawSectionTitle(title);
        const sorted = [...approvals].sort((a, b) => a.stepOrder - b.stepOrder);
        const rows = sorted.map((a) => {
          const isNoted = a.status === 'ACKNOWLEDGED' && (a.remarks || '').includes('Noted by');
          const statusLabel = isNoted ? 'Noted' : a.status;
          const statusKey = isNoted ? 'ACKNOWLEDGED_NOTED' : a.status;
          const performer = a.performedBy
            ? `${a.performedBy.fname} ${a.performedBy.lname}`
            : a.performedById ? `User ${a.performedById}` : '—';
          return {
            cells: [
              a.departmentCode,
              statusLabel,
              performer,
              a.performedAt ? fmtDT(a.performedAt) : '—',
              a.remarks || a.revisionReason || '—',
            ],
            statusKey,
          };
        });
        drawTable(
          [
            { label: 'Department', width: CW * 0.16 },
            { label: 'Status', width: CW * 0.16, badge: true },
            { label: 'Performed By', width: CW * 0.22 },
            { label: 'Timestamp', width: CW * 0.22 },
            { label: 'Remarks', width: CW * 0.24 },
          ],
          rows
        );
      };

      if (reservation.isReschedule && Array.isArray(reservation.originalApprovals) && reservation.originalApprovals.length > 0) {
        renderApprovals(reservation.originalApprovals, 'Original Approval Flow');
      }
      renderApprovals(
        reservation.approvals,
        reservation.isReschedule ? 'New Approval Flow (Reschedule)' : 'Approval Flow'
      );

      // ── Pack Up Done ──────────────────────────────────────────
      if (reservation.packUpDoneAt) {
        ensureSpace(90);
        drawSectionTitle('Pack Up Done');

        const pb = reservation.packUpDoneBy;
        const packUpBy = pb
          ? `${pb.fname || ''} ${pb.lname || ''}${pb.email ? ` (${pb.email})` : ''}${pb.departmentCode ? ` - ${pb.departmentCode}` : ''}`.trim()
          : '—';

        const photoCount = Array.isArray(reservation.packUpDonePhotos) ? reservation.packUpDonePhotos.length : 0;
        const lines = [
          `Marked by: ${packUpBy}`,
          `Date & Time: ${fmtDT(reservation.packUpDoneAt)}`,
        ];
        if (reservation.packUpDoneNotes) lines.push(`Notes: ${reservation.packUpDoneNotes}`);
        if (photoCount > 0) lines.push(`Photo Proof: ${photoCount} attached (available in app)`);

        doc.fontSize(9).font('Helvetica');
        const innerW = CW - 24;
        let contentH = 0;
        lines.forEach((l, i) => {
          doc.font(i === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
          contentH += doc.heightOfString(l, { width: innerW }) + 4;
        });
        const boxH2 = contentH + 20;

        const bx2Y = y;
        doc.rect(M, bx2Y, CW, boxH2).fillAndStroke(COL.packUpBg, COL.packUpBorder);
        let ty = bx2Y + 10;
        lines.forEach((l, i) => {
          doc.fontSize(9).font(i === 0 ? 'Helvetica-Bold' : 'Helvetica').fillColor(COL.text)
            .text(l, M + 12, ty, { width: innerW });
          ty += doc.heightOfString(l, { width: innerW }) + 4;
        });
        y = bx2Y + boxH2 + 8;
      }

      // ── Footer ────────────────────────────────────────────────
      ensureSpace(40);
      y += 6;
      doc.moveTo(M, y).lineTo(M + CW, y).lineWidth(0.5).strokeColor(COL.border).stroke();
      y += 6;
      doc.fontSize(7.5).font('Helvetica').fillColor(COL.muted)
        .text(
          `This is a system-generated document from NCST D-Forms.  •  Printed on ${fmtDT(new Date())}`,
          M, y, { align: 'center', width: CW }
        );

      // ── Page numbers (only if multi-page) ─────────────────────
      const range = doc.bufferedPageRange();
      if (range.count > 1) {
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          doc.fontSize(7).font('Helvetica').fillColor('#999999')
            .text(
              `Page ${i - range.start + 1} of ${range.count}`,
              M, doc.page.height - 25, { align: 'center', width: CW }
            );
        }
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}