import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { load, save, logAudit } from '@/lib/store';
import { requireAuth, requireSuperAdmin } from '@/lib/auth';

export async function POST(request, { params }) {
  const auth = requireAuth(request, 'admin');
  if (auth.error) return auth.error;
  const forbidden = requireSuperAdmin(auth.user);
  if (forbidden) return forbidden;

  const { newPassword } = await request.json();
  if (!newPassword) return NextResponse.json({ error: 'newPassword is required' }, { status: 400 });
  const data = load();
  const emp = data.employees.find((e) => e.id === Number(params.id));
  if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  emp.passwordHash = bcrypt.hashSync(newPassword, 10);
  emp.activeDeviceId = null; // force re-login on new device
  logAudit(data, auth.user, 'Reset Employee Password', `${emp.name} (${emp.employeeCode})`);
  save(data);
  return NextResponse.json({ ok: true });
}
