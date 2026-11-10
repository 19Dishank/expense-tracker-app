import { DEFAULT_CATEGORIES, SUGGESTED_CATEGORIES } from '../constants/defaultCategories';
import { getPeriodForDate, getPeriodsBetween, buildPeriods, toDateString, formatDisplayDate } from '../utils/period';

// Runs once when the app opens. Creates tables if they don't exist yet.
export async function initDatabase(db) {
  console.log('Initializing database...');

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    -- Simple key/value settings (example: period_start_day)
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    -- Expense categories (customisable)
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    -- Every income and expense entry
    -- type: 'expense' or 'income'
    -- amount: stored in paise (rupees x 100) to avoid decimal errors
    -- category_id: used for expenses
    -- source: used for income (Salary, Freelance, anything)
    -- date: 'YYYY-MM-DD'
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
      amount INTEGER NOT NULL,
      category_id INTEGER,
      source TEXT,
      note TEXT,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories (id)
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date);
  `);

  // Safe migration: add is_archived to categories only if it is missing.
  // Archived categories are hidden from the dashboard but keep old history intact.
  const columns = await db.getAllAsync('PRAGMA table_info(categories)');
  const hasArchived = columns.some((col) => col.name === 'is_archived');
  if (!hasArchived) {
    console.log('Adding is_archived column to categories...');
    await db.execAsync(
      'ALTER TABLE categories ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0'
    );
  }

  // Safe migration: remember which expenses were paid in cash (used by the Cash card).
  // The flag only marks an entry. It never changes any total.
  const txColumns = await db.getAllAsync('PRAGMA table_info(transactions)');
  if (!txColumns.some((col) => col.name === 'paid_in_cash')) {
    console.log('Adding paid_in_cash column to transactions...');
    await db.execAsync('ALTER TABLE transactions ADD COLUMN paid_in_cash INTEGER NOT NULL DEFAULT 0');
  }

  // Money you converted into physical cash. It lives in its OWN table so it can never
  // be added to, or subtracted from, income, expenses or the balance.
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS cash_conversions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount INTEGER NOT NULL CHECK (amount > 0),
      note TEXT,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_cash_conversions_date ON cash_conversions (date);
  `);

  // Salary periods start on the day the salary arrives, so the start dates are stored.
  // A period runs from its start date to the day before the next start date.
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS period_starts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_date TEXT NOT NULL UNIQUE
    );
  `);

  // One-time migration: turn the old "same day every month" setting into stored start dates,
  // so every existing period in History stays exactly as it was.
  const startsRow = await db.getFirstAsync('SELECT COUNT(*) AS count FROM period_starts');
  if (startsRow.count === 0) {
    const savedDay = await db.getFirstAsync("SELECT value FROM settings WHERE key = 'period_start_day'");
    if (savedDay) {
      const startDay = parseInt(savedDay.value, 10);
      const currentOld = getPeriodForDate(startDay, new Date());
      const range = await db.getFirstAsync(
        `SELECT MIN(d) AS minDate FROM (
          SELECT date AS d FROM transactions
          UNION ALL
          SELECT date AS d FROM cash_conversions
        )`
      );
      let firstDate = currentOld.start;
      if (range && range.minDate && range.minDate < firstDate) {
        firstDate = range.minDate;
      }
      const oldPeriods = getPeriodsBetween(startDay, firstDate, currentOld.start);
      for (const p of oldPeriods) {
        await db.runAsync('INSERT OR IGNORE INTO period_starts (start_date) VALUES (?)', [p.start]);
      }
      console.log('Migrated period start day to start dates:', oldPeriods.length);
    }
  }

  // Add default categories only the first time
  const row = await db.getFirstAsync('SELECT COUNT(*) AS count FROM categories');
  if (row.count === 0) {
    console.log('Seeding default categories...');
    for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
      const c = DEFAULT_CATEGORIES[i];
      await db.runAsync(
        'INSERT INTO categories (name, icon, color, sort_order) VALUES (?, ?, ?, ?)',
        [c.name, c.icon, c.color, i]
      );
    }
  }

  console.log('Database ready');
}

// ---------- Settings helpers ----------

export async function getSetting(db, key) {
  const row = await db.getFirstAsync('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : null;
}

export async function setSetting(db, key, value) {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, String(value)]
  );
}

// ---------- Category helpers ----------

// Active (not archived) categories in the user's chosen order
export async function getCategories(db) {
  return await db.getAllAsync(
    'SELECT * FROM categories WHERE is_archived = 0 ORDER BY sort_order ASC, id ASC'
  );
}

// Adds a new category at the end of the list
export async function addCategory(db, { name, icon, color }) {
  const row = await db.getFirstAsync(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM categories'
  );
  const result = await db.runAsync(
    'INSERT INTO categories (name, icon, color, sort_order) VALUES (?, ?, ?, ?)',
    [name, icon, color, row.next]
  );
  console.log('Category added:', name, result.lastInsertRowId);
  return { id: result.lastInsertRowId, name, icon, color };
}

// Finds an ACTIVE category by name (case-insensitive). Pass excludeId when editing a category,
// so it does not count as a duplicate of itself. Returns null when there is none.
export async function findActiveCategoryByName(db, name, excludeId = null) {
  const row = await db.getFirstAsync(
    'SELECT id, name, icon, color FROM categories WHERE LOWER(name) = LOWER(?) AND is_archived = 0 AND id != ?',
    [name.trim(), excludeId === null ? -1 : excludeId]
  );
  return row || null;
}

// Safe way to add a category:
// - already exists and is active -> reuse it (no duplicates)
// - exists but was archived      -> bring it back, so its old entries show up again
// - does not exist               -> create it
// Always returns { id, name, icon, color }.
export async function createOrRestoreCategory(db, { name, icon, color }) {
  const cleanName = name.trim();
  const active = await findActiveCategoryByName(db, cleanName);
  if (active) {
    console.log('Category already exists, using it:', cleanName);
    return active;
  }
  const archived = await db.getFirstAsync(
    'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND is_archived = 1 ORDER BY id DESC',
    [cleanName]
  );
  if (archived) {
    const row = await db.getFirstAsync(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM categories'
    );
    await db.runAsync(
      'UPDATE categories SET is_archived = 0, icon = ?, color = ?, sort_order = ? WHERE id = ?',
      [icon, color, row.next, archived.id]
    );
    console.log('Category restored:', cleanName, archived.id);
    return { id: archived.id, name: cleanName, icon, color };
  }
  return await addCategory(db, { name: cleanName, icon, color });
}

export async function updateCategory(db, id, { name, icon, color }) {
  await db.runAsync('UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ?', [
    name,
    icon,
    color,
    id,
  ]);
  console.log('Category updated:', id);
}

// If the category has entries it is archived (hidden, history stays intact).
// If it has no entries it is deleted for good.
// Returns 'archived' or 'deleted'.
export async function archiveOrDeleteCategory(db, id) {
  const row = await db.getFirstAsync(
    'SELECT COUNT(*) AS count FROM transactions WHERE category_id = ?',
    [id]
  );
  if (row.count > 0) {
    await db.runAsync('UPDATE categories SET is_archived = 1 WHERE id = ?', [id]);
    console.log('Category archived:', id);
    return 'archived';
  }
  await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
  console.log('Category deleted:', id);
  return 'deleted';
}

// orderedIds = category ids in the new order, first item is shown first
export async function reorderCategories(db, orderedIds) {
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.runAsync('UPDATE categories SET sort_order = ? WHERE id = ?', [i, orderedIds[i]]);
    }
  });
  console.log('Categories reordered');
}

// Returns all SUGGESTED_CATEGORIES that are NOT currently active.
// Match is case-insensitive by name. Archived (deleted) categories do not count,
// so a suggestion you deleted earlier shows up again and can be restored.
export async function getSuggestedCategories(db) {
  const existing = await db.getAllAsync(
    'SELECT LOWER(name) AS lname FROM categories WHERE is_archived = 0'
  );
  const existingNames = new Set(existing.map((r) => r.lname));
  const result = SUGGESTED_CATEGORIES.filter(
    (s) => !existingNames.has(s.name.toLowerCase())
  );
  console.log('Suggested categories (not yet added):', result.length);
  return result;
}

// ---------- Transaction helpers ----------

// data = { type, amount, categoryId, source, note, date, paidInCash }
export async function addTransaction(db, data) {
  await db.runAsync(
    'INSERT INTO transactions (type, amount, category_id, source, note, date, paid_in_cash) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [data.type, data.amount, data.categoryId, data.source, data.note, data.date, data.paidInCash ? 1 : 0]
  );
  await ensurePeriodCovers(db, data.date);
  console.log('Transaction added:', data);
}

export async function updateTransaction(db, id, data) {
  await db.runAsync(
    'UPDATE transactions SET type = ?, amount = ?, category_id = ?, source = ?, note = ?, date = ?, paid_in_cash = ? WHERE id = ?',
    [data.type, data.amount, data.categoryId, data.source, data.note, data.date, data.paidInCash ? 1 : 0, id]
  );
  await ensurePeriodCovers(db, data.date);
  console.log('Transaction updated:', id);
}

export async function deleteTransaction(db, id) {
  await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
  console.log('Transaction deleted:', id);
}

// All entries between two dates (inclusive), newest first.
// LEFT JOIN keeps entries even if their category was archived.
export async function getTransactionsForPeriod(db, start, end) {
  const rows = await db.getAllAsync(
    `SELECT t.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.date >= ? AND t.date <= ?
    ORDER BY t.date DESC, t.id DESC`,
    [start, end]
  );
  console.log('Transactions loaded:', rows.length);
  return rows;
}

// Previously used income sources (newest first) for the quick-select chips
export async function getIncomeSources(db) {
  const rows = await db.getAllAsync(
    `SELECT source FROM transactions
    WHERE type = 'income' AND source IS NOT NULL
    GROUP BY source
    ORDER BY MAX(id) DESC
    LIMIT 8`
  );
  return rows.map((r) => r.source);
}

// ---------- Totals helpers ----------

// Total income and total expense between two dates (inclusive)
export async function getPeriodTotals(db, start, end) {
  const row = await db.getFirstAsync(
    `SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount END), 0) AS income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) AS expense
    FROM transactions
    WHERE date >= ? AND date <= ?`,
    [start, end]
  );
  console.log('Period totals:', row);
  return row;
}

// Every active category with its expense total between two dates.
// Archived categories are included only when they have spending in this range,
// so old history stays correct.
export async function getCategoryTotals(db, start, end) {
  const rows = await db.getAllAsync(
    `SELECT c.id, c.name, c.icon, c.color, c.is_archived, COALESCE(SUM(t.amount), 0) AS total
    FROM categories c
    LEFT JOIN transactions t
      ON t.category_id = c.id AND t.type = 'expense' AND t.date >= ? AND t.date <= ?
    GROUP BY c.id
    HAVING c.is_archived = 0 OR total > 0
    ORDER BY c.sort_order ASC, c.id ASC`,
    [start, end]
  );
  console.log('Category totals loaded:', rows.length);
  return rows;
}

// ---------- Period helpers ----------

// All period start dates, oldest first
export async function getPeriodStarts(db) {
  const rows = await db.getAllAsync('SELECT start_date FROM period_starts ORDER BY start_date ASC');
  return rows.map((r) => r.start_date);
}

// All periods, oldest first. The last one is the current period and has no end yet.
export async function getPeriodList(db) {
  return buildPeriods(await getPeriodStarts(db));
}

// The current period (the latest one), or null before the first start date is set
export async function getCurrentPeriod(db) {
  const list = await getPeriodList(db);
  return list.length === 0 ? null : list[list.length - 1];
}

// The earliest date used by any entry or cash conversion, or null when there is none
async function getEarliestEntryDate(db) {
  const row = await db.getFirstAsync(
    `SELECT MIN(d) AS minDate FROM (
      SELECT date AS d FROM transactions
      UNION ALL
      SELECT date AS d FROM cash_conversions
    )`
  );
  return row ? row.minDate : null;
}

// Makes sure no entry falls before the first period. If an entry is dated earlier than the
// first start date, the first period starts earlier, so the entry still belongs to a period.
async function ensurePeriodCovers(db, dateStr) {
  await db.runAsync(
    `UPDATE period_starts SET start_date = ?
    WHERE start_date = (SELECT MIN(start_date) FROM period_starts) AND ? < start_date`,
    [dateStr, dateStr]
  );
}

// First launch: the first period starts on the day your last salary arrived
export async function startFirstPeriod(db, dateStr) {
  await db.runAsync('INSERT OR IGNORE INTO period_starts (start_date) VALUES (?)', [dateStr]);
  console.log('First period started on:', dateStr);
}

// Start a new period on the day your salary arrived. The current period ends the day before.
// There is no minimum or maximum length: early salary and late salary both work.
// todayStr is a parameter only so the rule can be tested.
export async function startNewPeriod(db, dateStr, todayStr = toDateString(new Date())) {
  const starts = await getPeriodStarts(db);
  if (starts.length === 0) {
    await startFirstPeriod(db, dateStr);
    return;
  }
  const currentStart = starts[starts.length - 1];
  if (dateStr > todayStr) {
    throw new Error('The new period cannot start in the future.');
  }
  if (dateStr <= currentStart) {
    throw new Error(
      'The new period must start after the current one, which started on ' + formatDisplayDate(currentStart) + '.'
    );
  }
  await db.runAsync('INSERT INTO period_starts (start_date) VALUES (?)', [dateStr]);
  console.log('New period started on:', dateStr);
}

// Fix the start date of the current period.
// With an earlier period before it, the date must stay after that period's start.
// With no earlier period, entries must not end up before the start (they would belong to no period).
export async function changeCurrentPeriodStart(db, dateStr, todayStr = toDateString(new Date())) {
  const starts = await getPeriodStarts(db);
  if (starts.length === 0) {
    throw new Error('There is no period yet.');
  }
  const currentStart = starts[starts.length - 1];
  const previousStart = starts.length > 1 ? starts[starts.length - 2] : null;
  if (dateStr > todayStr) {
    throw new Error('The period cannot start in the future.');
  }
  if (previousStart && dateStr <= previousStart) {
    throw new Error(
      'The period must start after the previous one, which started on ' + formatDisplayDate(previousStart) + '.'
    );
  }
  if (!previousStart) {
    const earliest = await getEarliestEntryDate(db);
    if (earliest && dateStr > earliest) {
      throw new Error(
        'You have an entry dated ' + formatDisplayDate(earliest) + '. The first period must start on or before it.'
      );
    }
  }
  await db.runAsync('UPDATE period_starts SET start_date = ? WHERE start_date = ?', [dateStr, currentStart]);
  console.log('Current period start changed to:', dateStr);
}

// Undo a period that was started by mistake. The previous period becomes the current one again.
// No entry is deleted, they simply join the previous period.
export async function removeCurrentPeriodStart(db) {
  const starts = await getPeriodStarts(db);
  if (starts.length < 2) {
    throw new Error('There is no earlier period to go back to.');
  }
  await db.runAsync('DELETE FROM period_starts WHERE start_date = ?', [starts[starts.length - 1]]);
  console.log('Went back to the previous period');
}

// Builds the list of all periods (newest first) with income, expense and savings for each.
export async function getAllPeriods(db) {
  const periods = await getPeriodList(db);
  const result = [];
  for (const p of periods) {
    const t = await getPeriodTotals(db, p.start, p.end);
    result.push({
      ...p,
      income: t.income,
      expense: t.expense,
      savings: t.income - t.expense,
      isCurrent: p.isOpen,
    });
  }
  result.reverse();
  console.log('All periods built:', result.length);
  return result;
}

// ---------- Cash helpers ----------
// "Converted to cash" is money you took out as physical cash (ATM, UPI cash-out, friend).
// It is shown separately and is NEVER added to or subtracted from income, expense or the balance.

// data = { amount, date, note }
export async function addCashConversion(db, data) {
  await db.runAsync('INSERT INTO cash_conversions (amount, date, note) VALUES (?, ?, ?)', [
    data.amount,
    data.date,
    data.note,
  ]);
  await ensurePeriodCovers(db, data.date);
  console.log('Cash conversion added:', data);
}

export async function updateCashConversion(db, id, data) {
  await db.runAsync('UPDATE cash_conversions SET amount = ?, date = ?, note = ? WHERE id = ?', [
    data.amount,
    data.date,
    data.note,
    id,
  ]);
  await ensurePeriodCovers(db, data.date);
  console.log('Cash conversion updated:', id);
}

export async function deleteCashConversion(db, id) {
  await db.runAsync('DELETE FROM cash_conversions WHERE id = ?', [id]);
  console.log('Cash conversion deleted:', id);
}

// Cash conversions between two dates (inclusive), newest first
export async function getCashConversionsForPeriod(db, start, end) {
  return await db.getAllAsync(
    'SELECT * FROM cash_conversions WHERE date >= ? AND date <= ? ORDER BY date DESC, id DESC',
    [start, end]
  );
}

// carriedForward = cash you already had when this period started
//                  (all cash converted before it, minus all cash expenses before it)
// converted      = cash converted inside this period
// cashSpent      = expenses marked "paid in cash" inside this period
// inWallet       = carriedForward + converted - cashSpent
// Cash is physical money in your pocket, so unlike your balance it does NOT reset when a new
// period starts. It carries forward. For a past period, inWallet is the cash left at its end.
export async function getCashSummary(db, start, end) {
  const row = await db.getFirstAsync(
    `SELECT
      (SELECT COALESCE(SUM(amount), 0) FROM cash_conversions WHERE date >= ? AND date <= ?) AS converted,
      (SELECT COALESCE(SUM(amount), 0) FROM transactions
        WHERE type = 'expense' AND paid_in_cash = 1 AND date >= ? AND date <= ?) AS cashSpent,
      (SELECT COALESCE(SUM(amount), 0) FROM cash_conversions WHERE date < ?) AS convertedBefore,
      (SELECT COALESCE(SUM(amount), 0) FROM transactions
        WHERE type = 'expense' AND paid_in_cash = 1 AND date < ?) AS cashSpentBefore`,
    [start, end, start, end, start, start]
  );
  const carriedForward = row.convertedBefore - row.cashSpentBefore;
  const summary = {
    carriedForward,
    converted: row.converted,
    cashSpent: row.cashSpent,
    inWallet: carriedForward + row.converted - row.cashSpent,
  };
  console.log('Cash summary:', summary);
  return summary;
}

// TEMPORARY TEST HELPER - remove after testing
// Deletes every expense and income entry. Categories and settings are kept.
// Archived (hidden) categories are removed too, because nothing uses them anymore.
export async function clearAllTransactions(db) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM transactions');
    await db.runAsync('DELETE FROM cash_conversions');
    await db.runAsync('DELETE FROM categories WHERE is_archived = 1');
    await db.runAsync("DELETE FROM sqlite_sequence WHERE name = 'transactions'");
    await db.runAsync("DELETE FROM sqlite_sequence WHERE name = 'cash_conversions'");
  });
  console.log('All transactions cleared (test helper)');
}

// TEMPORARY TEST HELPER - remove after testing
// Completely resets the app to a brand new install state:
// wipes all transactions, categories, and settings, and re-seeds only DEFAULT_CATEGORIES.
export async function resetEntireApp(db) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM transactions');
    await db.runAsync('DELETE FROM cash_conversions');
    await db.runAsync('DELETE FROM period_starts');
    await db.runAsync('DELETE FROM categories');
    await db.runAsync('DELETE FROM settings');
    await db.runAsync("DELETE FROM sqlite_sequence WHERE name = 'transactions'");
    await db.runAsync("DELETE FROM sqlite_sequence WHERE name = 'cash_conversions'");
    await db.runAsync("DELETE FROM sqlite_sequence WHERE name = 'categories'");

    for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
      const c = DEFAULT_CATEGORIES[i];
      await db.runAsync(
        'INSERT INTO categories (name, icon, color, sort_order) VALUES (?, ?, ?, ?)',
        [c.name, c.icon, c.color, i]
      );
    }
  });
  console.log('App database completely reset to fresh state with default categories (test helper)');
}
