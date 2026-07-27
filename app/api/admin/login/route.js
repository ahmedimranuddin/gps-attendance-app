import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { load, save, logAudit } from '@/lib/store';
import { signToken } from '@/lib/utils';

export async function POST(request) {
  const { username, password } = await request.json();
  if (!username || !password) {
    return NextResponse.json({ error: 'username and password required' }, { status: 400 });
  }
  const data = load();
  const admin = data.admins.find(
    (a) => a.username.toLowerCase() === String(username).toLowerCase() || a.email?.toLowerCase() === String(username).toLowerCase()
  );
  if (!admin) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  if (admin.active === false) {
    return NextResponse.json({ error: 'This admin account has been deactivated.' }, { status: 403 });
  }
  if (!bcrypt.compareSync(password, admin.passwordHash)) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }
  const token = signToken({ role: 'admin', id: admin.id, username: admin.username, adminRole: admin.role || 'superadmin' });
  logAudit(data, { id: admin.id, username: admin.username }, 'Login', '');
  save(data);
  return NextResponse.json({ token, admin: { id: admin.id, username: admin.username, email: admin.email, role: admin.role || 'superadmin' } });
}
