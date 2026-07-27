import { NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import { load } from '@/lib/store';
import { requireAuth } from '@/lib/auth';
import {
  filterPunches,
  groupByEmployeeDay,
  buildAbsenteeRows,
  sortReportRows,
  getReportDates,
  describeFilters
} from '@/lib/reportHelpers';

// Same filters as /attendance and /attendance/export (date, month, fromDate/toDate range,
// employeeId, department), rendered as a printable landscape PDF table.
export async function GET(request) {
  const auth = requireAuth(request, 'admin');
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const month = searchParams.get('month');
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');
  const employeeId = searchParams.get('employeeId');
  const department = searchParams.get('department');

  const data = load();
  let punches = filterPunches(data.punches, { date, month, fromDate, toDate, employeeId });
  let rows = groupByEmployeeDay(punches, data);
  if (department) rows = rows.filter((r) => r.department.toLowerCase() === String(department).toLowerCase());
  const absenteeRows = buildAbsenteeRows(getReportDates({ date, month, fromDate, toDate }), data, { employeeId, department });
  rows = sortReportRows([...rows, ...absenteeRows]);

  const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
  const chunks = [];
  const pdfPromise = new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const headers = ['ID', 'Employee', 'Dept', 'Date', 'First In', 'Last Out', 'Sessions', 'Total Hours', 'Status', 'Office'];
  const colWidths = [35, 125, 80, 65, 55, 55, 50, 65, 55, 90];
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

  doc.fontSize(16).font('Helvetica-Bold').text('Attendance Report', { align: 'center' });
  doc.font('Helvetica').fontSize(10).fillColor('#555555')
    .text(describeFilters({ date, month, fromDate, toDate, department }), { align: 'center' });
  doc.fillColor('#000000');
  doc.moveDown(1);

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
      [
        r.employeeId,
        `${r.employeeName} (${r.employeeCode})`,
        r.department || '-',
        r.date,
        r.punchInTime || '--:--',
        r.punchOutTime || (r.status === 'Absent' ? '--:--' : 'still in'),
        r.sessionCount,
        r.totalWorked,
        r.status,
        r.officeName || '-'
      ],
      y,
      idx % 2 === 1
    );
    y += rowHeight;
  });

  if (!rows.length) {
    doc.fontSize(10).fillColor('#777777').text('No punch records match this filter.', startX, y + 4);
    y += rowHeight;
  }

  if (y + 30 > pageBottom) {
    doc.addPage();
    y = doc.page.margins.top;
  }
  const summary = {
    present: rows.filter((r) => r.status === 'Present').length,
    late: rows.filter((r) => r.status === 'Late').length,
    absent: rows.filter((r) => r.status === 'Absent').length
  };
  doc.moveDown();
  doc.fontSize(10).fillColor('#000000').font('Helvetica-Bold')
    .text(`Present: ${summary.present}    Late: ${summary.late}    Absent: ${summary.absent}    Total records: ${rows.length}`, startX, y + 14);

  doc.end();
  const buffer = await pdfPromise;

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="attendance_report.pdf"'
    }
  });
}
