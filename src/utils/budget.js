import { parseDateString } from './period';
import { formatINR } from './money';
import { colors } from '../constants/theme';

// Calculations for the "Remaining balance" card. All money is in paise.

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// totalDays = length of the period, daysLeft = days remaining INCLUDING today,
// elapsedDays = days passed INCLUDING today (at least 1)
export function getPeriodDays(periodStart, periodEnd, today = new Date()) {
  const start = parseDateString(periodStart);
  const end = parseDateString(periodEnd);
  const now = startOfDay(today);
  const totalDays = Math.round((end - start) / DAY_MS) + 1;
  const daysLeft = Math.min(Math.max(Math.round((end - now) / DAY_MS) + 1, 0), totalDays);
  const elapsedDays = Math.min(totalDays, totalDays - daysLeft + 1);
  return { totalDays, daysLeft, elapsedDays };
}

// Everything the balance card needs, in one object.
// status: 'empty' | 'good' | 'warning' | 'over'
export function getBudgetSummary(income, expense, periodStart, periodEnd, today = new Date()) {
  const remaining = income - expense;
  const { totalDays, daysLeft, elapsedDays } = getPeriodDays(periodStart, periodEnd, today);

  const spentRatio = income > 0 ? expense / income : 0;
  const percentSpent = Math.round(spentRatio * 100);
  const progress = Math.min(spentRatio, 1); // for the progress bar (0 to 1)

  let status = 'good';
  let message = 'On track';
  if (income <= 0 && expense <= 0) {
    status = 'empty';
    message = 'Add your income to get started';
  } else if (remaining < 0) {
    status = 'over';
    message = 'Spent ' + formatINR(-remaining) + ' more than income';
  } else if (spentRatio >= 0.8) {
    status = 'warning';
    message = remaining === 0 ? 'All income spent' : percentSpent + '% of income spent';
  }

  return {
    remaining,
    status,
    message,
    progress,
    percentSpent,
    totalDays,
    daysLeft,
    elapsedDays,
  };
}

// Color for a status (used for the amount, the progress bar and the chip)
export function statusColor(status) {
  if (status === 'over') {
    return colors.expense;
  }
  if (status === 'warning') {
    return colors.warning;
  }
  if (status === 'good') {
    return colors.income;
  }
  return colors.textMuted;
}
