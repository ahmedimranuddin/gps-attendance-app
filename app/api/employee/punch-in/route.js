import { NextResponse } from 'next/server';
import { load, save, nextId } from '@/lib/store';
import { requireAuth } from '@/lib/auth';
import { distanceMeters, todayDateStr, timeStr, computeStatus } from '@/lib/utils';

function getEmployee(data, user) {
  return data.employees.find((e) => e.id === user.id);
}

export async function POST(request) {
  const auth = requireAuth(request, 'employee');
  if (auth.error) return auth.error;

  const { latitude, longitude, accuracy, deviceInfo, mockLocation } = await request.json();
  if (latitude == null || longitude == null) return NextResponse.json({ error: 'latitude and longitude are required' }, { status: 400 });

  // Basic mock-location guard (section 7). Real detection needs native Android APIs
  // (Location.isFromMockProvider()); the app should send that flag here.
  if (mockLocation === true) {
    return NextResponse.json({ error: 'Mock/fake GPS location detected. Punch rejected.' }, { status: 403 });
  }

  const data = load();
  const emp = getEmployee(data, auth.user);
  if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  const office = data.offices.find((o) => o.id === emp.officeId);
  if (!office) return NextResponse.json({ error: 'No office assigned to this employee' }, { status: 400 });

  const today = todayDateStr();
  const todaySessions = data.punches.filter((p) => p.employeeId === emp.id && p.date === today);
  const openSession = todaySessions.find((s) => s.punchInTime && !s.punchOutTime);
  if (openSession) {
    return NextResponse.json({ error: 'You already have an open session — punch out before punching in again.' }, { status: 409 });
  }

  const dist = distanceMeters(Number(latitude), Number(longitude), office.latitude, office.longitude);
  if (dist > office.radiusMeters) {
    return NextResponse.json(
      { error: `You are ${Math.round(dist)}m from ${office.name}, outside the allowed ${office.radiusMeters}m radius.` },
      { status: 403 }
    );
  }

  // Each punch-in starts a NEW session record — an employee can come and go
  // multiple times a day (e.g. morning shift + evening shift); all sessions
  // for the day are summed into total hours worked.
  const now = new Date();
  const punchRecord = {
    id: nextId(data, 'punches'),
    employeeId: emp.id,
    date: today,
    punchInTime: timeStr(now),
    punchOutTime: null,
    punchInLat: Number(latitude),
    punchInLng: Number(longitude),
    punchInAccuracy: accuracy != null ? Number(accuracy) : null,
    punchOutLat: null,
    punchOutLng: null,
    punchOutAccuracy: null,
    deviceInfo: deviceInfo || null,
    serverTimestampIn: now.toISOString(),
    serverTimestampOut: null
  };
  data.punches.push(punchRecord);
  save(data);

  const firstToday = [...todaySessions, punchRecord].sort((a, b) => a.id - b.id)[0];
  return NextResponse.json({
    ok: true,
    punchInTime: punchRecord.punchInTime,
    status: computeStatus(firstToday.punchInTime, office.startTime, office.graceMinutes)
  });
}
