import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { load } from '@/lib/store';
import { requireAuth } from '@/lib/auth';
import {
  filterPunches,
  groupByEmployeeDay,
  buildAbsenteeRows,
  sortReportRows,
  getReportDates
} from '@/lib/reportHelpers';

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

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Attendance');
  sheet.columns = [
    { header: 'Employee ID', key: 'employeeId', width: 12 },
    { header: 'Employee Code', key: 'employeeCode', width: 15 },
    { header: 'Name', key: 'employeeName', width: 22 },
    { header: 'Department', key: 'department', width: 16 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'First Punch In', key: 'punchInTime', width: 14 },
    { header: 'Last Punch Out', key: 'punchOutTime', width: 14 },
    { header: 'Sessions', key: 'sessionCount', width: 10 },
    { header: 'Total Hours Worked', key: 'totalWorked', width: 16 },
    { header: 'Status', key: 'status', width: 10 },
    { header: 'Office', key: 'officeName', width: 16 }
  ];
  rows.forEach((r) => sheet.addRow(r));
  sheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="attendance_report.xlsx"'
    }
  });
}
