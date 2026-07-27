import { NextResponse } from 'next/server';
import { load, save, logAudit } from '@/lib/store';
import { requireAuth, requireSuperAdmin } from '@/lib/auth';
import { safeAdmin } from '@/lib/reportHelpers';

export async function PUT(request, { params }) {
  const auth = requireAuth(request, 'admin');
  if (auth.error) return auth.error;
  const forbidden = requireSuperAdmin(auth.user);
  if (forbidden) return forbidden;

  const data = load();
  const admin = data.admins.find((a) => a.id === Number(params.id));
  if (!admin) return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
  const { email, role, active } = await request.json();
  if (role != null) {
    if (!['superadmin', 'manager'].includes(role)) {
      return NextResponse.json({ error: "role must be 'superadmin' or 'manager'" }, { status: 400 });
    }
    if (admin.id === auth.user.id && role !== 'superadmin') {
      return NextResponse.json({ error: 'You cannot remove your own Super Admin role.' }, { status: 400 });
    }
    admin.role = role;
  }
  if (email != null) admin.email = email;
  if (active != null) {
    if (admin.id === auth.user.id && active === false) {
      return NextResponse.json({ error: 'You cannot deactivate your own account.' }, { status: 400 });
    }
    const remainingSuperadmins = data.admins.filter((a) => a.role === 'superadmin' && a.active !== false && a.id !== admin.id).length;
    if (active === false && admin.role === 'superadmin' && remainingSuperadmins === 0) {
      return NextResponse.json({ error: 'At least one active Super Admin must remain.' }, { status: 400 });
    }
    admin.active = Boolean(active);
  }
  logAudit(data, auth.user, 'Edit Admin', `${admin.username}`);
  save(data);
  return NextResponse.json(safeAdmin(admin));
}
