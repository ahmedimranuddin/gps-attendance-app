import { NextResponse } from 'next/server';
import { load, save } from '@/lib/store';
import { requireAuth } from '@/lib/auth';
import { distanceMeters, todayDateStr, timeStr } from '@/lib/utils';

function getEmployee(data, user) {
  return data.employees.find((e) => e.id === user.id);
}

export async function POST(request) {
  const auth = requireAuth(request, 'employee');
  if (auth.error) return auth.error;

  const { latitude, longitude, accuracy, deviceInfo, mockLocation } = await request.json();
  if (latitude == null || longitude == null) return NextResponse.json({ error: 'latitude and longitude are required' }, { status: 400 });

  if (mockLocation === true) {
    return NextResponse.json({ error: 'Mock/fake GPS location detected. Punch rejected.' }, { status: 403 });
  }

  const data = load();
  const emp = getEmployee(data, auth.user);
  if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  const office = data.offices.find((o) => o.id === emp.officeId);
  if (!office) return NextResponse.json({ error: 'No office assigned to this employee' }, { status: 400 });

  const today = todayDateStr();
  const punchRecord = data.punches.find((p) => p.employeeId === emp.id && p.date === today && p.punchInTime && !p.punchOutTime);
  if (!punchRecord) {
    return NextResponse.json({ error: 'You must Punch In before you can Punch Out' }, { status: 409 });
  }

  const dist = distanceMeters(Number(latitude), Number(longitude), office.latitude, office.longitude);
  if (dist > office.radiusMeters) {
    return NextResponse.json(
      { error: `You are ${Math.round(dist)}m from ${office.name}, outside the allowed ${office.radiusMeters}m radius.` },
      { status: 403 }
    );
  }

  const now = new Date();
  punchRecord.punchOutTime = timeStr(now);
  punchRecord.punchOutLat = Number(latitude);
  punchRecord.punchOutLng = Number(longitude);
  punchRecord.punchOutAccuracy = accuracy != null ? Number(accuracy) : null;
  punchRecord.deviceInfo = deviceInfo || punchRecord.deviceInfo;
  punchRecord.serverTimestampOut = now.toISOString();
  save(data);

  return NextResponse.json({ ok: true, punchOutTime: punchRecord.punchOutTime });
}
