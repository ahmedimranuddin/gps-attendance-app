import { NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import { load } from '@/lib/store';
import { requireAuth } from '@/lib/auth';
import { getOwnHistoryRows } from '@/lib/employeeHistory';

function getEmployee(data, user) {
  return data.employees.find((e) => e.id === user.id);
}

// Employees can only ever export their OWN history — employeeId always comes from
// the authenticated token (getEmployee), never from the request.
export async function GET(request) {
  const auth = requireAuth(request, 'employee');
  if (auth.error) return auth.error;

  const data = load();
  const emp = getEmployee(data, auth.user);
  if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  const office = data.offices.find((o) => o.id === emp.officeId);
  const { searchParams } = new URL(request.url);
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');
  const rows = getOwnHistoryRows(data, emp, office, { fromDate, toDate }).sort((a, b) => a.date.localeCompare(b.date));

  const doc = new PDFDocument({ margin: 30, size: 'A4' });
  const chunks = [];
  const pdfPromise = new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.fontSize(16).font('Helvetica-Bold').text('My Attendance History', { align: 'center' });
  doc.font('Helvetica').fontSize(10).fillColor('#555555').text(`${emp.name} (${emp.employeeCode})`, { align: 'center' });
  let subtitle = 'All records';
  if (fromDate && toDate) subtitle = `Date range: ${fromDate} to ${toDate}`;
  else if (fromDate) subtitle = `From: ${fromDate}`;
  else if (toDate) subtitle = `Up to: ${toDate}`;
  doc.text(subtitle, { align: 'center' });
  doc.fillColor('#000000');
  doc.moveDown(1);

  const headers = ['Date', 'First In', 'Last Out', 'Sessions', 'Total Hours', 'Status'];
  const colWidths = [80, 80, 80, 60, 90, 80];
  const startX = doc.page.margins.left;
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  const rowHeight = 18;

  function drawHeaderRow(y) {
    doc.rect(startX, y - 3, tableWidth, rowHeight).fill('#2d3748');
    let x = startX;
    doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold');
    headers.forEach((h, i) => {
      doc.text(h, x + 4, y, { width: colWidths[i] - 6, ellipsis: true });
      x += colWidths[i];
    });
    doc.font('Helvetica').fillColor('#000000');
  }

  function drawDataRow(cells, y, striped) {
    if (striped) doc.rect(startX, y - 3, tableWidth, rowHeight).fill('#f4f5f7').fillColor('#000000');
    let x = startX;
    doc.fontSize(8.5).fillColor('#1a1a1a');
    cells.forEach((c, i) => {
      doc.text(String(c), x + 4, y, { width: colWidths[i] - 6, ellipsis: true });
      x += colWidths[i];
    });
  }

  let y = doc.y;
  drawHeaderRow(y);
  y += rowHeight;

  const pageBottom = doc.page.height - doc.page.margins.bottom;
  rows.forEach((r, idx) => {
    if (y + rowHeight > pageBottom) {
      doc.addPage();
      y = doc.page.margins.top;
      drawHeaderRow(y);
      y += rowHeight;
    }
    drawDataRow(
      [r.date, r.punchInTime || '--:--', r.punchOutTime || 'still in', r.sessions.length, r.totalWorked, r.status],
      y,
      idx % 2 === 1
    );
    y += rowHeight;
  });

  if (!rows.length) {
    doc.fontSize(10).fillColor('#777777').text('No punch records for this range.', startX, y + 4);
  }

  doc.end();
  const buffer = await pdfPromise;

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="my_attendance_history.pdf"'
    }
  });
}
