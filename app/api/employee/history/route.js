import { NextResponse } from 'next/server';
import { load } from '@/lib/store';
import { requireAuth } from '@/lib/auth';
import { getOwnHistoryRows } from '@/lib/employeeHistory';

function getEmployee(data, user) {
  return data.employees.find((e) => e.id === user.id);
}

export async function GET(request) {
  const auth = requireAuth(request, 'employee');
  if (auth.error) return auth.error;

  const data = load();
  const emp = getEmployee(data, auth.user);
  if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  const office = data.offices.find((o) => o.id === emp.officeId);
  const { searchParams } = new URL(request.url);
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');
  return NextResponse.json(getOwnHistoryRows(data, emp, office, { fromDate, toDate }));
}
