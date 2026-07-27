import { NextResponse } from 'next/server';
import { load, save, logAudit } from '@/lib/store';
import { requireAuth, requireSuperAdmin } from '@/lib/auth';

// Permanently removes an employee record. Only allowed when the employee has
// no punch history at all — otherwise attendance/report rows referencing
// their employeeId would end up with a blank name/code forever. For anyone
// who has ever punched in, use Deactivate instead (keeps history intact).
export async function DELETE(request, { params }) {
  const auth = requireAuth(request, 'admin');
  if (auth.error) return auth.error;
  const forbidden = requireSuperAdmin(auth.user);
  if (forbidden) return forbidden;

  const data = load();
  const id = Number(params.id);
  const emp = data.employees.find((e) => e.id === id);
  if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

  const hasPunches = data.punches.some((p) => p.employeeId === id);
  if (hasPunches) {
    return NextResponse.json(
      {
        error: 'This employee has attendance history and cannot be permanently deleted — use Deactivate instead to preserve their records.'
      },
      { status: 400 }
    );
  }

  data.employees = data.employees.filter((e) => e.id !== id);
  logAudit(data, auth.user, 'Delete Employee', `${emp.name} (${emp.employeeCode})`);
  save(data);
  return NextResponse.json({ ok: true });
}
