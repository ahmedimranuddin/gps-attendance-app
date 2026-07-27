import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { load, save, logAudit } from '@/lib/store';
import { signToken } from '@/lib/utils';

export async function POST(request) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'username and password required' }, { status: 400 });
    }

    // Hardcoded fallback admin for Vercel serverless reliability
    const isHardcodedAdmin = 
      String(username).toLowerCase() === 'admin' && password === 'Admin@123';

    let adminData = null;

    if (isHardcodedAdmin) {
      adminData = {
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        role: 'superadmin',
        active: true
      };
    } else {
      const data = load();
      const admin = data.admins?.find(
        (a) => a.username.toLowerCase() === String(username).toLowerCase() || a.email?.toLowerCase() === String(username).toLowerCase()
      );

      if (admin) {
        if (admin.active === false) {
          return NextResponse.json({ error: 'This admin account has been deactivated.' }, { status: 403 });
        }
        if (bcrypt.compareSync(password, admin.passwordHash)) {
          adminData = {
            id: admin.id,
            username: admin.username,
            email: admin.email,
            role: admin.role || 'superadmin',
            active: true
          };
        }
      }
    }

    if (!adminData) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = signToken({ role: 'admin', id: adminData.id, username: adminData.username, adminRole: adminData.role });
    
    try {
      const data = load();
      logAudit(data, { id: adminData.id, username: adminData.username }, 'Login', '');
      save(data);
    } catch (e) {
      // Ignore write errors on read-only serverless file system
    }

    return NextResponse.json({ 
      token, 
      admin: { 
        id: adminData.id, 
        username: adminData.username, 
        email: adminData.email, 
        role: adminData.role 
      } 
    });

  } catch (err) {
    return NextResponse.json({ error: 'Server error: ' + err.message }, { status: 500 });
  }
}
