import { NextResponse } from 'next/server';
import { load } from '@/lib/store';
import { requireAuth } from '@/lib/auth';

// Read access is available to any logged-in admin (transparency for managers too);
// only superadmins can change roster/office/admin data in the first place.
export async function GET(request) {
  const auth = requireAuth(request, 'admin');
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');
  const action = searchParams.get('action');
  const adminId = searchParams.get('adminId');
  const limit = searchParams.get('limit');

  const data = load();
  let rows = [...data.auditLog];
  if (fromDate) rows = rows.filter((r) => r.timestamp.slice(0, 10) >= fromDate);
  if (toDate) rows = rows.filter((r) => r.timestamp.slice(0, 10) <= toDate);
  if (action) rows = rows.filter((r) => r.action === action);
  if (adminId) rows = rows.filter((r) => r.adminId === Number(adminId));
  rows.sort((a, b) => b.id - a.id);
  const capped = rows.slice(0, Number(limit) || 300);
  return NextResponse.json({ rows: capped, total: rows.length });
}
