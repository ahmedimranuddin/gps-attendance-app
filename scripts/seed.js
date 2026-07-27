// Bootstraps the data file with a first admin account and one demo office.
// Run once: npm run seed
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(process.cwd(), 'db', 'data.json');

const DEFAULT_DATA = {
  admins: [],
  offices: [],
  employees: [],
  punches: [],
  auditLog: [],
  meta: { nextIds: { admins: 1, offices: 1, employees: 1, punches: 1, auditLog: 1 } }
};

function load() {
  if (!fs.existsSync(path.dirname(DB_FILE))) fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function save(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function nextId(data, table) {
  return data.meta.nextIds[table]++;
}

const data = load();

if (data.admins.length === 0) {
  const admin = {
    id: nextId(data, 'admins'),
    username: 'admin',
    email: 'admin@example.com',
    passwordHash: bcrypt.hashSync('Admin@123', 10),
    role: 'superadmin',
    active: true
  };
  data.admins.push(admin);
  console.log('Created admin login -> username: admin / password: Admin@123 (change this immediately)');
} else {
  console.log('Admin already exists, skipping.');
}

if (data.offices.length === 0) {
  const office = {
    id: nextId(data, 'offices'),
    name: 'Main Office (Dhaka)',
    latitude: 23.780636,
    longitude: 90.279541,
    radiusMeters: 150,
    startTime: '09:00',
    graceMinutes: 15
  };
  data.offices.push(office);
  console.log(`Created demo office "${office.name}" — edit its coordinates in the admin panel to match your real office.`);
}

save(data);
console.log('Seed complete. Start the server with: npm run dev');
