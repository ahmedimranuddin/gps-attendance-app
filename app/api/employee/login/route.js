import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { load, save } from '@/lib/store';
import { signToken } from '@/lib/utils';

export async function POST(request) {
  const { idOrMobile, password, deviceId } = await request.json();
  if (!idOrMobile || !password) return NextResponse.json({ error: 'idOrMobile and password required' }, { status: 400 });
  const data = load();
  const emp = data.employees.find((e) => e.employeeCode === idOrMobile || e.mobile === idOrMobile);
  if (!emp || !emp.active) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  if (!bcrypt.compareSync(password, emp.passwordHash)) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

  // Basic single-device control (section 7): lock account to first device that logs in.
  // Admin can clear this via "unlock device".
  if (emp.activeDeviceId && deviceId && emp.activeDeviceId !== deviceId) {
    return NextResponse.json({ error: 'This account is already active on another device. Ask your admin to unlock it.' }, { status: 403 });
  }
  if (deviceId && !emp.activeDeviceId) {
    emp.activeDeviceId = deviceId;
    save(data);
  }

  const token = signToken({ role: 'employee', id: emp.id, employeeCode: emp.employeeCode });
  return NextResponse.json({ token, employee: { id: emp.id, employeeCode: emp.employeeCode, name: emp.name } });
}
