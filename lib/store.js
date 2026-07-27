// Simple JSON-file backed data store.
// Good enough for a 50-employee prototype; swap for MySQL/Postgres in production.
import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'db', 'data.json');

const DEFAULT_DATA = {
  admins: [],
  offices: [],
  employees: [],
  punches: [],
  auditLog: [],
  meta: { nextIds: { admins: 1, offices: 1, employees: 1, punches: 1, auditLog: 1 } }
};

// Patches older data.json files (created before roles/audit log existed) so the
// rest of the app can always assume these fields exist.
function migrate(data) {
  if (!Array.isArray(data.auditLog)) data.auditLog = [];
  if (!data.meta) data.meta = { nextIds: {} };
  if (!data.meta.nextIds) data.meta.nextIds = {};
  if (data.meta.nextIds.auditLog == null) data.meta.nextIds.auditLog = 1;
  data.admins.forEach((a) => {
    if (!a.role) a.role = 'superadmin'; // pre-existing admins keep full access
    if (a.active == null) a.active = true;
  });
  return data;
}

export function load() {
  if (!fs.existsSync(path.dirname(DB_FILE))) {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
  }
  const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  return migrate(data);
}

export function save(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

export function nextId(data, table) {
  const id = data.meta.nextIds[table]++;
  return id;
}

// Appends an audit log entry. `admin` is the req.user JWT payload (or an
// object with id/username) of whoever performed the action. Caller is
// responsible for calling save(data) afterwards.
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
