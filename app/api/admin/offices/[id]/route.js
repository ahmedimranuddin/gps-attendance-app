import { NextResponse } from 'next/server';
import { load, save, logAudit } from '@/lib/store';
import { requireAuth, requireSuperAdmin } from '@/lib/auth';

export async function PUT(request, { params }) {
  const auth = requireAuth(request, 'admin');
  if (auth.error) return auth.error;
  const forbidden = requireSuperAdmin(auth.user);
  if (forbidden) return forbidden;

  const data = load();
  const office = data.offices.find((o) => o.id === Number(params.id));
  if (!office) return NextResponse.json({ error: 'Office not found' }, { status: 404 });
  const { name, latitude, longitude, radiusMeters, startTime, graceMinutes } = await request.json();
  if (name != null) office.name = name;
  if (latitude != null) office.latitude = Number(latitude);
  if (longitude != null) office.longitude = Number(longitude);
  if (radiusMeters != null) office.radiusMeters = Number(radiusMeters);
  if (startTime != null) office.startTime = startTime;
  if (graceMinutes != null) office.graceMinutes = Number(graceMinutes);
  logAudit(data, auth.user, 'Edit Office', office.name);
  save(data);
  return NextResponse.json(office);
}

export async function DELETE(request, { params }) {
  const auth = requireAuth(request, 'admin');
  if (auth.error) return auth.error;
  const forbidden = requireSuperAdmin(auth.user);
  if (forbidden) return forbidden;

  const data = load();
  const idx = data.offices.findIndex((o) => o.id === Number(params.id));
  if (idx === -1) return NextResponse.json({ error: 'Office not found' }, { status: 404 });
  const removed = data.offices[idx];

  const assignedCount = data.employees.filter((e) => e.officeId === removed.id && e.active).length;
  if (assignedCount > 0) {
    return NextResponse.json(
      {
        error: `${assignedCount} active employee${assignedCount === 1 ? ' is' : 's are'} still assigned to "${removed.name}" — reassign them to a different office first (Employees tab) before deleting this location.`
      },
      { status: 400 }
    );
  }

  data.offices.splice(idx, 1);
  logAudit(data, auth.user, 'Delete Office', removed.name);
  save(data);
  return NextResponse.json({ ok: true });
}
