import { NextResponse } from 'next/server';
import { load } from '@/lib/store';
import { requireAuth } from '@/lib/auth';
import { computeStatus, formatDuration, totalMinutesWorked } from '@/lib/utils';

// Unlike /attendance (which groups into one row per employee-per-day), this returns
// every individual punch-in/punch-out session for a single employee, most recent first.
// Supports the same fromDate/toDate range as the other report endpoints.
export async function GET(request, { params }) {
  const auth = requireAuth(request, 'admin');
  if (auth.error) return auth.error;

  const data = load();
  const emp = data.employees.find((e) => e.id === Number(params.id));
  if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  const office = data.offices.find((o) => o.id === emp.officeId);
  const { searchParams } = new URL(request.url);
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');
  const date = searchParams.get('date');
  const month = searchParams.get('month');

  let sessions = data.punches.filter((p) => p.employeeId === emp.id);
  if (date) sessions = sessions.filter((p) => p.date === date);
  if (month) sessions = sessions.filter((p) => p.date.startsWith(month));
  if (fromDate) sessions = sessions.filter((p) => p.date >= fromDate);
  if (toDate) sessions = sessions.filter((p) => p.date <= toDate);

  // Figure out, per date, which session was the FIRST one that day (status is decided
  // by the first punch-in of the day, same rule used everywhere else in the app).
  const firstIdByDate = {};
  data.punches
    .filter((p) => p.employeeId === emp.id)
    .forEach((p) => {
      if (firstIdByDate[p.date] == null || p.id < firstIdByDate[p.date]) firstIdByDate[p.date] = p.id;
    });

  sessions = [...sessions].sort((a, b) => (a.date === b.date ? b.id - a.id : b.date.localeCompare(a.date)));

  const rows = sessions.map((s) => ({
    id: s.id,
    date: s.date,
    punchInTime: s.punchInTime,
    punchOutTime: s.punchOutTime,
    durationWorked: formatDuration(totalMinutesWorked([s])),
    isFirstSessionOfDay: firstIdByDate[s.date] === s.id,
    status: firstIdByDate[s.date] === s.id ? computeStatus(s.punchInTime, office?.startTime, office?.graceMinutes) : null,
    punchInLat: s.punchInLat,
    punchInLng: s.punchInLng,
    punchOutLat: s.punchOutLat,
    punchOutLng: s.punchOutLng,
    deviceInfo: s.deviceInfo
  }));

  return NextResponse.json({
    employee: { id: emp.id, employeeCode: emp.employeeCode, name: emp.name, department: emp.department },
    office: office ? { name: office.name } : null,
    rows
  });
}
