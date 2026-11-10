// Helpers for custom "salary periods" (example: 15 Jan to 14 Feb)

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(n) {
  return String(n).padStart(2, '0');
}

// Date -> 'YYYY-MM-DD' using the phone's local time
export function toDateString(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 'YYYY-MM-DD' -> Date at local midnight
export function parseDateString(str) {
  const parts = str.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

// "15 Oct"
function formatShort(d) {
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

// "15 Oct 2026"
function formatFull(d) {
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

// 'YYYY-MM-DD' -> "15 Oct 2026" (used on entry rows)
export function formatDisplayDate(str) {
  return formatFull(parseDateString(str));
}

// Returns the period that contains the given date.
// startDay = 15 -> a date on 20 Jan gives 15 Jan to 14 Feb
export function getPeriodForDate(startDay, date = new Date()) {
  let startYear = date.getFullYear();
  let startMonth = date.getMonth();

  // If we are before the start day, the period started last month
  if (date.getDate() < startDay) {
    startMonth -= 1;
    if (startMonth < 0) {
      startMonth = 11;
      startYear -= 1;
    }
  }

  const start = new Date(startYear, startMonth, startDay);
  // Day before the next start day (JS handles month/year overflow)
  const end = new Date(startYear, startMonth + 1, startDay - 1);

  const period = {
    start: toDateString(start),
    end: toDateString(end),
    label: `${formatShort(start)} - ${formatShort(end)}`,
    fullLabel: `${formatFull(start)} - ${formatFull(end)}`,
  };
  console.log('Current period:', period);
  return period;
}

// Returns every period from the one containing firstDateStr
// to the one containing lastDateStr (oldest first).
export function getPeriodsBetween(startDay, firstDateStr, lastDateStr) {
  const periods = [];
  const last = getPeriodForDate(startDay, parseDateString(lastDateStr));
  let current = getPeriodForDate(startDay, parseDateString(firstDateStr));

  // The counter is a safety stop so a bug can never loop forever
  let guard = 0;
  while (current.start <= last.start && guard < 600) {
    periods.push(current);
    // Move to the day after this period ends
    const nextDay = parseDateString(current.end);
    nextDay.setDate(nextDay.getDate() + 1);
    current = getPeriodForDate(startDay, nextDay);
    guard += 1;
  }
  return periods;
}

// ---------- Periods that start on the day your salary arrives ----------
// Salary does not arrive on the same day every month, so a period is not "the 15th to the 14th".
// A period starts on a day you choose and runs until the day before the NEXT start.
// The current period has no end yet: it can be shorter or longer than a month.

// The current period has no end date. This far-future date is used in database queries
// (date <= end), so everything dated from the start onwards belongs to it.
export const OPEN_END = '9999-12-31';

// 'YYYY-MM-DD' plus a number of days (negative goes back) -> 'YYYY-MM-DD'
export function addDays(dateStr, days) {
  const d = parseDateString(dateStr);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

// Turns the stored start dates (oldest first) into period objects (oldest first).
// Every period runs from its start date to the day before the next start date.
// The last period is the current one: it is open (no end yet).
export function buildPeriods(startDates) {
  return startDates.map((startStr, i) => {
    const start = parseDateString(startStr);
    if (i === startDates.length - 1) {
      return {
        start: startStr,
        end: OPEN_END,
        isOpen: true,
        label: `Since ${formatShort(start)}`,
        fullLabel: `${formatFull(start)} - now`,
      };
    }
    const endStr = addDays(startDates[i + 1], -1);
    const end = parseDateString(endStr);
    return {
      start: startStr,
      end: endStr,
      isOpen: false,
      label: `${formatShort(start)} - ${formatShort(end)}`,
      fullLabel: `${formatFull(start)} - ${formatFull(end)}`,
    };
  });
}

