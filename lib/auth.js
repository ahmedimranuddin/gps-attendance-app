import { NextResponse } from 'next/server';
import { verifyToken } from './utils';

// Express used `router.use(requireAuth('admin'))` to gate every route below
// it. Next.js route handlers don't chain middleware the same way, so each
// handler calls requireAuth(request, role) itself. Returns { user } on
// success, or { error: NextResponse } to short-circuit with the same
// status/body the original middleware sent.
export function requireAuth(request, role) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return { error: NextResponse.json({ error: 'Missing token' }, { status: 401 }) };
  }
  const payload = verifyToken(token);
  if (!payload) {
    return { error: NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 }) };
  }
  if (role && payload.role !== role) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user: payload };
}

// Gates handlers to admins whose adminRole is 'superadmin'. Call after
// requireAuth(request, 'admin') so `user` is already populated. 'manager'-role
// admins get a 403 with a clear message instead of the generic Forbidden.
export function requireSuperAdmin(user) {
  if (user?.adminRole !== 'superadmin') {
    return NextResponse.json({ error: 'This action requires a Super Admin role.' }, { status: 403 });
  }
  return null;
}
