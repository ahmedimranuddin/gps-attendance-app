import { NextResponse } from 'next/server';
import { load } from '@/lib/store';
import { requireAuth } from '@/lib/auth';
import { filterPunches, groupByEmployeeDay, summarize } from '@/lib/reportHelpers';

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

  // Also compute absentees for a specific date: active employees with no punch that day
  let absentees = [];
  if (date) {
    const punchedIds = new Set(punches.filter((p) => p.date === date).map((p) => p.employeeId));
    absentees = data.employees
      .filter((e) => e.active && !punchedIds.has(e.id) && (!department || e.department.toLowerCase() === String(department).toLowerCase()))
      .map((e) => ({
        employeeId: e.id,
        employeeCode: e.employeeCode,
        employeeName: e.name,
        department: e.department,
        date,
        status: 'Absent',
        punchInTime: null,
        punchOutTime: null
      }));
  }

  return NextResponse.json({ rows, absentees, summary: summarize(rows, absentees) });
}
