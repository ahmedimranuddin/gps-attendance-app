import { computeStatus, formatDuration, totalMinutesWorked } from './utils';

// Optional fromDate/toDate ("YYYY-MM-DD") let the employee narrow their own history
// to a date range, same convention used on the admin side.
export function getOwnHistoryRows(data, emp, office, { fromDate, toDate } = {}) {
  const byDate = {};
  data.punches
    .filter((p) => p.employeeId === emp.id)
    .filter((p) => (!fromDate || p.date >= fromDate) && (!toDate || p.date <= toDate))
    .forEach((p) => {
      if (!byDate[p.date]) byDate[p.date] = [];
      byDate[p.date].push(p);
    });

  return Object.keys(byDate)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((date) => {
      const sessions = byDate[date].sort((a, b) => a.id - b.id);
      const first = sessions[0];
      const last = sessions[sessions.length - 1];
      return {
        date,
        sessions: sessions.map((s) => ({ punchInTime: s.punchInTime, punchOutTime: s.punchOutTime })),
        punchInTime: first.punchInTime,
        punchOutTime: last.punchOutTime,
        totalWorked: formatDuration(totalMinutesWorked(sessions)),
        status: computeStatus(first.punchInTime, office?.startTime, office?.graceMinutes)
      };
    });
}
