import { computeStatus, formatDuration, totalMinutesWorked, todayDateStr } from './utils';

export function safeEmployee(e) {
  const { passwordHash, ...rest } = e;
  return rest;
}

export function safeAdmin(a) {
  const { passwordHash, ...rest } = a;
  return rest;
}

// ---------- Attendance / reports ----------
// Groups an employee's punch records for one day into a single reportable row:
// first punch-in / last punch-out / all sessions / total hours worked.
export function groupByEmployeeDay(punches, data) {
  const groups = {};
  punches.forEach((p) => {
    const key = p.employeeId + '|' + p.date;
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });

  return Object.values(groups).map((sessions) => {
    sessions.sort((a, b) => a.id - b.id);
    const first = sessions[0];
    const last = sessions[sessions.length - 1];
    const emp = data.employees.find((e) => e.id === first.employeeId);
    const office = emp ? data.offices.find((o) => o.id === emp.officeId) : null;
    const status = office
      ? computeStatus(first.punchInTime, office.startTime, office.graceMinutes)
      : first.punchInTime
      ? 'Present'
      : 'Absent';
    return {
      employeeId: first.employeeId,
      employeeCode: emp?.employeeCode || '',
      employeeName: emp?.name || '',
      department: emp?.department || '',
      officeName: office?.name || '',
      date: first.date,
      punchInTime: first.punchInTime,
      punchOutTime: last.punchOutTime,
      sessionCount: sessions.length,
      sessions: sessions.map((s) => ({ punchInTime: s.punchInTime, punchOutTime: s.punchOutTime })),
      totalWorked: formatDuration(totalMinutesWorked(sessions)),
      status
    };
  });
}

export function summarize(rows, absentees) {
  const present = rows.filter((r) => r.status === 'Present').length;
  const late = rows.filter((r) => r.status === 'Late').length;
  const absent = absentees.length;
  return { present, late, absent, total: present + late + absent };
}

// Shared date/month/range/employee filtering used by the list, Excel export, and PDF export.
// fromDate/toDate ("YYYY-MM-DD") let the admin pick an arbitrary date-to-date range;
// they combine with (and narrow further than) the single-date/month filters if both are sent.
export function filterPunches(punches, { date, month, fromDate, toDate, employeeId }) {
  let result = punches;
  if (date) result = result.filter((p) => p.date === date);
  if (month) result = result.filter((p) => p.date.startsWith(month));
  if (fromDate) result = result.filter((p) => p.date >= fromDate);
  if (toDate) result = result.filter((p) => p.date <= toDate);
  if (employeeId) result = result.filter((p) => p.employeeId === Number(employeeId));
  return result;
}

export function describeFilters({ date, month, fromDate, toDate, department }) {
  let label;
  if (fromDate && toDate) label = `Date range: ${fromDate} to ${toDate}`;
  else if (fromDate) label = `From: ${fromDate}`;
  else if (toDate) label = `Up to: ${toDate}`;
  else if (date) label = `Date: ${date}`;
  else if (month) label = `Month: ${month}`;
  else label = 'All records';
  if (department) label += `  |  Department: ${department}`;
  return label;
}

// Adds n days to a 'YYYY-MM-DD' string and returns the result in the same format.
export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Works out the concrete list of 'YYYY-MM-DD' dates a report covers, so we know
// which days to check for absentees. Returns null when the range is unbounded
// (no date/month/range filter at all) since there's no sensible day-by-day
// absentee list to build in that case.
export function getReportDates({ date, month, fromDate, toDate }) {
  const today = todayDateStr();
  if (fromDate && toDate) {
    const dates = [];
    for (let d = fromDate; d <= toDate; d = addDays(d, 1)) dates.push(d);
    return dates;
  }
  if (date) return [date];
  if (month) {
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate(); // day 0 of next month = last day of this month
    const lastDateStr = `${month}-${String(lastDay).padStart(2, '0')}`;
    const cappedLast = lastDateStr > today ? today : lastDateStr;
    const firstDateStr = `${month}-01`;
    if (firstDateStr > cappedLast) return [];
    const dates = [];
    for (let d = firstDateStr; d <= cappedLast; d = addDays(d, 1)) dates.push(d);
    return dates;
  }
  return null;
}

// Builds one "Absent" row per active employee per date they had no punch,
// shaped like the groupByEmployeeDay rows so it can be merged straight into
// the same report table/sheet.
export function buildAbsenteeRows(reportDates, data, { employeeId, department }) {
  if (!reportDates) return [];
  const punchedByDate = {};
  data.punches.forEach((p) => {
    if (!punchedByDate[p.date]) punchedByDate[p.date] = new Set();
    punchedByDate[p.date].add(p.employeeId);
  });

  const employees = data.employees.filter(
    (e) =>
      e.active &&
      (!employeeId || e.id === Number(employeeId)) &&
      (!department || (e.department || '').toLowerCase() === String(department).toLowerCase())
  );

  const rows = [];
  reportDates.forEach((d) => {
    const punchedIds = punchedByDate[d] || new Set();
    employees.forEach((e) => {
      if (punchedIds.has(e.id)) return;
      const office = data.offices.find((o) => o.id === e.officeId);
      rows.push({
        employeeId: e.id,
        employeeCode: e.employeeCode,
        employeeName: e.name,
        department: e.department || '',
        officeName: office?.name || '',
        date: d,
        punchInTime: null,
        punchOutTime: null,
        sessionCount: 0,
        totalWorked: '0h 0m',
        status: 'Absent'
      });
    });
  });
  return rows;
}

// Sort used across reports: Employee ID first (as requested), then date, so
// each employee's days appear grouped together in ID order.
export function sortReportRows(rows) {
  rows.sort((a, b) => a.employeeId - b.employeeId || a.date.localeCompare(b.date));
  return rows;
}
