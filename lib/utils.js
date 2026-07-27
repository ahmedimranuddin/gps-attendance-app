import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

// Haversine formula: distance in meters between two lat/lng points
export function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

// Returns YYYY-MM-DD for "today" based on server local time,
// with the attendance day rolling over at midnight (per spec section 5).
export function todayDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function timeStr(d = new Date()) {
  return d.toTimeString().slice(0, 8); // HH:MM:SS
}

// Compute Present/Late based on office start time + grace minutes
export function computeStatus(punchInTime, officeStartTime, graceMinutes) {
  if (!punchInTime) return 'Absent';
  const [ph, pm] = punchInTime.split(':').map(Number);
  const [sh, sm] = officeStartTime.split(':').map(Number);
  const punchMinutes = ph * 60 + pm;
  const deadlineMinutes = sh * 60 + sm + Number(graceMinutes || 0);
  return punchMinutes <= deadlineMinutes ? 'Present' : 'Late';
}

// Formats total minutes worked as "Xh Ym"
export function formatDuration(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return `${h}h ${m}m`;
}

// Sums worked minutes across a set of session records (each with serverTimestampIn/Out).
// Open sessions (no punch-out yet) count up to "now".
export function totalMinutesWorked(sessions) {
  const now = Date.now();
  return sessions.reduce((sum, s) => {
    if (!s.serverTimestampIn) return sum;
    const start = new Date(s.serverTimestampIn).getTime();
    const end = s.serverTimestampOut ? new Date(s.serverTimestampOut).getTime() : now;
    return sum + Math.max(0, (end - start) / 60000);
  }, 0);
}
