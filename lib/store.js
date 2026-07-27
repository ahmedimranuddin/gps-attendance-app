// Simple JSON-file backed data store with Auto-Seed for Vercel
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_FILE = path.join(process.cwd(), 'db', 'data.json');

const DEFAULT_DATA = {
  admins: [],
  offices: [],
  employees: [],
  punches: [],
  auditLog: [],
  meta: { nextIds: { admins: 1, offices: 1, employees: 1, punches: 1, auditLog: 1 } }
};

// Patches older data.json files
function migrate(data) {
  if (!Array.isArray(data.auditLog)) data.auditLog = [];
  if (!data.meta) data.meta = { nextIds: {} };
  if (!data.meta.nextIds) data.meta.nextIds = {};
  if (data.meta.nextIds.auditLog == null) data.meta.nextIds.auditLog = 1;
  data.admins.forEach((a) => {
    if (!a.role) a.role = 'superadmin';
    if (a.active == null) a.active = true;
  });
  return data;
}

export function load() {
  if (!fs.existsSync(path.dirname(DB_FILE))) {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  }
  
  let needsSave = false;
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
    needsSave = true;
  }

  const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  migrate(data);

  // Auto-seed default admin if none exists (Solves Vercel serverless issue)
  if (data.admins.length === 0) {
    const admin = {
      id: data.meta.nextIds.admins++,
      username: 'admin',
      email: 'admin@example.com',
      passwordHash: bcrypt.hashSync('Admin@123', 10),
      role: 'superadmin',
      active: true
    };
    data.admins.push(admin);
    needsSave = true;
  }

  // Auto-seed default office if none exists
  if (data.offices.length === 0) {
    const office = {
      id: data.meta.nextIds.offices++,
      name: 'Main Office (Dhaka)',
      latitude: 23.780636,
      longitude: 90.279541,
      radiusMeters: 150,
      startTime: '09:00',
      graceMinutes: 15
    };
    data.offices.push(office);
    needsSave = true;
  }

  if (needsSave) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  }

  return data;
}

export function save(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

export function nextId(data, table) {
  const id = data.meta.nextIds[table]++;
  return id;
}

export function logAudit(data, admin, action, details) {
  data.auditLog.push({
    id: nextId(data, 'auditLog'),
    timestamp: new Date().toISOString(),
    adminId: admin?.id ?? null,
    username: admin?.username || 'unknown',
    action,
    details: details || ''
  });
}

export { DB_FILE };
