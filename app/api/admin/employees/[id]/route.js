import { NextResponse } from 'next/server';
import { load, save, logAudit } from '@/lib/store';
import { requireAuth, requireSuperAdmin } from '@/lib/auth';
import { safeEmployee } from '@/lib/reportHelpers';

export async function PUT(request, { params }) {
  const auth = requireAuth(request, 'admin');
  if (auth.error) return auth.error;
  const forbidden = requireSuperAdmin(auth.user);
  if (forbidden) return forbidden;

  const data = load();
  const emp = data.employees.find((e) => e.id === Number(params.id));
  if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  const { name, mobile, department, designation, joiningDate, officeId, active } = await request.json();
  if (name != null) emp.name = name;
  if (mobile != null) emp.mobile = mobile;
  if (department != null) emp.department = department;
  if (designation != null) emp.designation = designation;
  if (joiningDate != null) emp.joiningDate = joiningDate;
  if (officeId != null) emp.officeId = Number(officeId);
  if (active != null) emp.active = Boolean(active);
  logAudit(data, auth.user, 'Edit Employee', `${emp.name} (${emp.employeeCode})`);
  save(data);
  return NextResponse.json(safeEmployee(emp));
}

export async function DELETE(request, { params }) {
  // "Deactivate" per spec rather than hard delete
  const auth = requireAuth(request, 'admin');
  if (auth.error) return auth.error;
  const forbidden = requireSuperAdmin(auth.user);
  if (forbidden) return forbidden;

  const data = load();
  const emp = data.employees.find((e) => e.id === Number(params.id));
  if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  emp.active = false;
  logAudit(data, auth.user, 'Deactivate Employee', `${emp.name} (${emp.employeeCode})`);
  save(data);
  return NextResponse.json({ ok: true });
}
