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
  const admin = data.admins.find((a) => a.id === Number(params.id));
  if (!admin) return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
  admin.passwordHash = bcrypt.hashSync(newPassword, 10);
  logAudit(data, auth.user, 'Reset Admin Password', admin.username);
  save(data);
  return NextResponse.json({ ok: true });
}
