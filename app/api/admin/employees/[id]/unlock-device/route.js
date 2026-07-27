import { NextResponse } from 'next/server';
import { load, save, logAudit } from '@/lib/store';
import { requireAuth, requireSuperAdmin } from '@/lib/auth';

// Clears the single-device lock so employee can log in from a new phone
export async function POST(request, { params }) {
  const auth = requireAuth(request, 'admin');
  if (auth.error) return auth.error;
  const forbidden = requireSuperAdmin(auth.user);
  if (forbidden) return forbidden;

  const data = load();
  const emp = data.employees.find((e) => e.id === Number(params.id));
  if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  emp.activeDeviceId = null;
  logAudit(data, auth.user, 'Unlock Employee Device', `${emp.name} (${emp.employeeCode})`);
  save(data);
  return NextResponse.json({ ok: true });
}
