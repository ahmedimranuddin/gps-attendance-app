import { NextResponse } from 'next/server';
import { load } from '@/lib/store';
import { requireAuth } from '@/lib/auth';
import { todayDateStr, timeStr, computeStatus, formatDuration, totalMinutesWorked } from '@/lib/utils';

function getEmployee(data, user) {
  return data.employees.find((e) => e.id === user.id);
}

export async function GET(request) {
  const auth = requireAuth(request, 'employee');
  if (auth.error) return auth.error;

  const data = load();
  const emp = getEmployee(data, auth.user);
  if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  const office = data.offices.find((o) => o.id === emp.officeId);
  const today = todayDateStr();
  const todaySessions = data.punches
    .filter((p) => p.employeeId === emp.id && p.date === today)
    .sort((a, b) => a.id - b.id);

  const firstSession = todaySessions[0] || null;
  const openSession = todaySessions.find((s) => s.punchInTime && !s.punchOutTime) || null;
  // Late/Present is decided by the FIRST punch-in of the day, not later sessions
  const status = firstSession ? computeStatus(firstSession.punchInTime, office?.startTime, office?.graceMinutes) : 'Not punched in';
  const totalMinutes = totalMinutesWorked(todaySessions);

  return NextResponse.json({
    name: emp.name,
    employeeCode: emp.employeeCode,
    department: emp.department,
    date: today,
    time: timeStr(),
    todayStatus: status,
    hasOpenSession: !!openSession,
    totalToday: formatDuration(totalMinutes),
    sessions: todaySessions.map((s) => ({ punchInTime: s.punchInTime, punchOutTime: s.punchOutTime })),
    office: office ? { name: office.name, radiusMeters: office.radiusMeters } : null
  });
}
