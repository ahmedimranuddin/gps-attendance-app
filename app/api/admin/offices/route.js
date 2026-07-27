import { NextResponse } from 'next/server';
import { load, save, nextId, logAudit } from '@/lib/store';
import { requireAuth, requireSuperAdmin } from '@/lib/auth';

// Viewing offices is fine for any admin (managers need it for filters/dropdowns);
// creating, editing, or deleting a location is a superadmin-only action.
export async function GET(request) {
  const auth = requireAuth(request, 'admin');
  if (auth.error) return auth.error;
  const data = load();
  return NextResponse.json(data.offices);
}

export async function POST(request) {
  const auth = requireAuth(request, 'admin');
  if (auth.error) return auth.error;
  const forbidden = requireSuperAdmin(auth.user);
  if (forbidden) return forbidden;

  const { name, latitude, longitude, radiusMeters, startTime, graceMinutes } = await request.json();
  if (!name || latitude == null || longitude == null || !radiusMeters || !startTime) {
    return NextResponse.json({ error: 'name, latitude, longitude, radiusMeters, startTime are required' }, { status: 400 });
  }
  const data = load();
  const office = {
    id: nextId(data, 'offices'),
    name,
    latitude: Number(latitude),
    longitude: Number(longitude),
    radiusMeters: Number(radiusMeters),
    startTime, // "09:00"
    graceMinutes: Number(graceMinutes || 0)
  };
  data.offices.push(office);
  logAudit(data, auth.user, 'Add Office', `${office.name} (radius ${office.radiusMeters}m, start ${office.startTime})`);
  save(data);
  return NextResponse.json(office);
}
