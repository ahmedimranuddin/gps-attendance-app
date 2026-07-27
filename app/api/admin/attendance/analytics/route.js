import { NextResponse } from 'next/server';
import { load } from '@/lib/store';
import { requireAuth } from '@/lib/auth';
import { filterPunches, groupByEmployeeDay, addDays } from '@/lib/reportHelpers';

// Same filters as the other attendance endpoints. Returns:
//  - daily: [{date, present, late, absent}] for a trend chart
//  - totals: {present, late, absent} for an overall distribution chart
//  - byDepartment: [{department, present, late}] for a department comparison chart
// Note: "absent" per day is estimated as (currently-active matching employees) minus
// (present + late that day) — historical roster changes (joiners/leavers) aren't tracked
// day-by-day, so this is an approximation, same as the rest of the app.
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
  const punches = filterPunches(data.punches, { date, month, fromDate, toDate, employeeId });
  let rows = groupByEmployeeDay(punches, data);
  if (department) rows = rows.filter((r) => r.department.toLowerCase() === String(department).toLowerCase());

  const matchingEmployees = data.employees.filter(
    (e) =>
      e.active &&
      (!department || (e.department || '').toLowerCase() === String(department).toLowerCase()) &&
      (!employeeId || e.id === Number(employeeId))
  );
  const totalActive = matchingEmployees.length;

  const byDateMap = {};
  // Zero-fill every date in the requested range so days with no punches at all
  // (e.g. a day nobody has clocked in yet) still show up as a 0/0/all-absent
  // point instead of being silently dropped from the trend, which shortened
  // or blanked out charts like the dashboard's "Last 7 Days Trend".
  if (fromDate && toDate) {
    for (let d = fromDate; d <= toDate; d = addDays(d, 1)) {
      byDateMap[d] = { date: d, present: 0, late: 0 };
    }
  }
  rows.forEach((r) => {
    if (!byDateMap[r.date]) byDateMap[r.date] = { date: r.date, present: 0, late: 0 };
    if (r.status === 'Present') byDateMap[r.date].present += 1;
    else if (r.status === 'Late') byDateMap[r.date].late += 1;
  });

  const daily = Object.values(byDateMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ ...d, absent: Math.max(0, totalActive - d.present - d.late) }));

  const totals = daily.reduce(
    (acc, d) => {
      acc.present += d.present;
      acc.late += d.late;
      acc.absent += d.absent;
      return acc;
    },
    { present: 0, late: 0, absent: 0 }
  );

  const byDeptMap = {};
  rows.forEach((r) => {
    const key = r.department || 'Unassigned';
    if (!byDeptMap[key]) byDeptMap[key] = { department: key, present: 0, late: 0 };
    if (r.status === 'Present') byDeptMap[key].present += 1;
    else if (r.status === 'Late') byDeptMap[key].late += 1;
  });
  const byDepartment = Object.values(byDeptMap).sort((a, b) => a.department.localeCompare(b.department));

  // Employee-wise attendance % ranking. "Working days" = distinct dates with any
  // activity in the filtered range (same approximation used for daily/absent
  // counts above, since there's no fixed office calendar tracked yet).
  // Note: this intentionally uses only dates that had at least one punch, NOT
  // the zero-filled `daily` array above — otherwise a range that includes days
  // nobody was ever expected to attend (e.g. weekends) would count as extra
  // "working days" and inflate everyone's absence count.
  const totalWorkingDays = new Set(rows.map((r) => r.date)).size;
  const byEmpMap = {};
  matchingEmployees.forEach((e) => {
    byEmpMap[e.id] = { employeeId: e.id, employeeCode: e.employeeCode, employeeName: e.name, department: e.department || '', present: 0, late: 0 };
  });
  rows.forEach((r) => {
    if (!byEmpMap[r.employeeId]) return; // not in matchingEmployees (e.g. deactivated) — skip
    if (r.status === 'Present') byEmpMap[r.employeeId].present += 1;
    else if (r.status === 'Late') byEmpMap[r.employeeId].late += 1;
  });
  const byEmployee = Object.values(byEmpMap)
    .map((e) => {
      const absent = Math.max(0, totalWorkingDays - e.present - e.late);
      const attendancePercent = totalWorkingDays > 0
        ? Math.round(((e.present + e.late) / totalWorkingDays) * 1000) / 10
        : 0;
      return { ...e, absent, attendancePercent };
    })
    .sort((a, b) => b.attendancePercent - a.attendancePercent || a.employeeName.localeCompare(b.employeeName));

  return NextResponse.json({ daily, totals, byDepartment, byEmployee, totalWorkingDays, totalActiveEmployees: totalActive });
}
