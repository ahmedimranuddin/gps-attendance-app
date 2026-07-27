import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { load, save, nextId, logAudit } from '@/lib/store';
import { requireAuth, requireSuperAdmin } from '@/lib/auth';
import { safeAdmin } from '@/lib/reportHelpers';

// ---------- Admin account management (superadmin only) ----------
export async function GET(request) {
  const auth = requireAuth(request, 'admin');
  if (auth.error) return auth.error;
  const forbidden = requireSuperAdmin(auth.user);
  if (forbidden) return forbidden;

  const data = load();
  return NextResponse.json(data.admins.map(safeAdmin));
}

export async function POST(request) {
  const auth = requireAuth(request, 'admin');
  if (auth.error) return auth.error;
  const forbidden = requireSuperAdmin(auth.user);
  if (forbidden) return forbidden;

  const { username, email, password, role } = await request.json();
  if (!username || !password) return NextResponse.json({ error: 'username and password are required' }, { status: 400 });
  if (role && !['superadmin', 'manager'].includes(role)) {
    return NextResponse.json({ error: "role must be 'superadmin' or 'manager'" }, { status: 400 });
  }
  const data = load();
  if (data.admins.some((a) => a.username.toLowerCase() === username.toLowerCase())) {
    return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
  }
  const admin = {
    id: nextId(data, 'admins'),
    username,
    email: email || '',
    passwordHash: bcrypt.hashSync(password, 10),
    role: role || 'manager',
    active: true
  };
  data.admins.push(admin);
  logAudit(data, auth.user, 'Add Admin', `${admin.username} (${admin.role})`);
  save(data);
  return NextResponse.json(safeAdmin(admin));
}
