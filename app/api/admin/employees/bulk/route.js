import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { load, save, nextId, logAudit } from '@/lib/store';
import { requireAuth, requireSuperAdmin } from '@/lib/auth';
import { safeEmployee } from '@/lib/reportHelpers';

// Bulk-create employees from a parsed CSV (client sends an array of row objects).
// Each row: employeeCode, name, mobile, password, department, designation,
// joiningDate, officeName (matched case-insensitively) or officeId.
// Invalid or duplicate rows are skipped and reported back individually so a
// single bad row doesn't block the whole import.
export async function POST(request) {
  const auth = requireAuth(request, 'admin');
  if (auth.error) return auth.error;
  const forbidden = requireSuperAdmin(auth.user);
  if (forbidden) return forbidden;

  const body = await request.json();
  const rows = Array.isArray(body.employees) ? body.employees : null;
  if (!rows || !rows.length) return NextResponse.json({ error: 'employees array is required' }, { status: 400 });

  const data = load();
  const created = [];
  const skipped = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // +2 so it lines up with a spreadsheet row (1 = header)
    const employeeCode = (row.employeeCode || '').trim();
    const name = (row.name || '').trim();
    const mobile = (row.mobile || '').trim();
    const password = (row.password || '').trim();
    const department = (row.department || '').trim();
    const designation = (row.designation || '').trim();
    const joiningDate = (row.joiningDate || '').trim() || null;

    if (!employeeCode || !name || !mobile || !password) {
      skipped.push({ row: rowNum, employeeCode, reason: 'Missing required field (employeeCode, name, mobile, or password)' });
      return;
    }

    let officeId = row.officeId ? Number(row.officeId) : null;
    if (!officeId && row.officeName) {
      const match = data.offices.find((o) => o.name.toLowerCase() === String(row.officeName).trim().toLowerCase());
      if (match) officeId = match.id;
    }
    if (!officeId || !data.offices.some((o) => o.id === officeId)) {
      skipped.push({ row: rowNum, employeeCode, reason: 'Office not found (check officeName spelling)' });
      return;
    }

    if (data.employees.some((e) => e.employeeCode === employeeCode) || created.some((e) => e.employeeCode === employeeCode)) {
      skipped.push({ row: rowNum, employeeCode, reason: 'Employee code already exists' });
      return;
    }
    if (data.employees.some((e) => e.mobile === mobile) || created.some((e) => e.mobile === mobile)) {
      skipped.push({ row: rowNum, employeeCode, reason: 'Mobile number already exists' });
      return;
    }

    const employee = {
      id: nextId(data, 'employees'),
      employeeCode,
      name,
      mobile,
      passwordHash: bcrypt.hashSync(password, 10),
      department,
      designation,
      joiningDate,
      officeId,
      active: true,
      activeDeviceId: null
    };
    data.employees.push(employee);
    created.push(employee);
  });

  logAudit(data, auth.user, 'Bulk Import Employees', `${created.length} created, ${skipped.length} skipped`);
  save(data);
  return NextResponse.json({ createdCount: created.length, created: created.map(safeEmployee), skipped });
}
