import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { load, save, nextId, logAudit } from '@/lib/store';
import { requireAuth, requireSuperAdmin } from '@/lib/auth';
import { safeEmployee } from '@/lib/reportHelpers';

// Viewing the roster is available to any admin; adding/editing/deactivating
// employees, resetting passwords, and bulk import are superadmin-only.
export async function GET(request) {
  const auth = requireAuth(request, 'admin');
  if (auth.error) return auth.error;
  const data = load();
  return NextResponse.json(data.employees.map(safeEmployee));
}

export async function POST(request) {
  const auth = requireAuth(request, 'admin');
  if (auth.error) return auth.error;
  const forbidden = requireSuperAdmin(auth.user);
  if (forbidden) return forbidden;

  const { employeeCode, name, mobile, password, department, designation, joiningDate, officeId } = await request.json();
  if (!employeeCode || !name || !mobile || !password || !officeId) {
    return NextResponse.json({ error: 'employeeCode, name, mobile, password, officeId are required' }, { status: 400 });
  }
  const data = load();
  if (data.employees.some((e) => e.employeeCode === employeeCode || e.mobile === mobile)) {
    return NextResponse.json({ error: 'Employee code or mobile already exists' }, { status: 409 });
  }
  const employee = {
    id: nextId(data, 'employees'),
    employeeCode,
    name,
    mobile,
    passwordHash: bcrypt.hashSync(password, 10),
    department: department || '',
    designation: designation || '',
    joiningDate: joiningDate || null,
    officeId: Number(officeId),
    active: true,
    activeDeviceId: null // basic single-device control (section 7)
  };
  data.employees.push(employee);
  logAudit(data, auth.user, 'Add Employee', `${employee.name} (${employee.employeeCode})`);
  save(data);
  return NextResponse.json(safeEmployee(employee));
}
