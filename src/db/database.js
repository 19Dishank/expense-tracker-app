import { DEFAULT_CATEGORIES, SUGGESTED_CATEGORIES } from '../constants/defaultCategories';
import { getPeriodForDate, getPeriodsBetween } from '../utils/period';

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

// data = { type, amount, categoryId, source, note, date }
export async function addTransaction(db, data) {
  await db.runAsync(
    'INSERT INTO transactions (type, amount, category_id, source, note, date) VALUES (?, ?, ?, ?, ?, ?)',
    [data.type, data.amount, data.categoryId, data.source, data.note, data.date]
  );
  console.log('Transaction added:', data);
}

export async function updateTransaction(db, id, data) {
  await db.runAsync(
    'UPDATE transactions SET type = ?, amount = ?, category_id = ?, source = ?, note = ?, date = ? WHERE id = ?',
    [data.type, data.amount, data.categoryId, data.source, data.note, data.date, id]
  );
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

// Builds the list of all periods (newest first) from the oldest entry
// up to the current period, with income, expense and savings for each.
export async function getAllPeriods(db, startDay) {
  const currentPeriod = getPeriodForDate(startDay, new Date());
  const range = await db.getFirstAsync(
    'SELECT MIN(date) AS minDate, MAX(date) AS maxDate FROM transactions'
  );

  let firstDate = currentPeriod.start;
  let lastDate = currentPeriod.start;
  if (range && range.minDate) {
    if (range.minDate < firstDate) {
      firstDate = range.minDate;
    }
    if (range.maxDate > lastDate) {
      lastDate = range.maxDate;
    }
  }

  const periods = getPeriodsBetween(startDay, firstDate, lastDate);
  const result = [];
  for (const p of periods) {
    const t = await getPeriodTotals(db, p.start, p.end);
    result.push({
      ...p,
      income: t.income,
      expense: t.expense,
      savings: t.income - t.expense,
      isCurrent: p.start === currentPeriod.start,
    });
  }
  result.reverse();
  console.log('All periods built:', result.length);
  return result;
}

// TEMPORARY TEST HELPER - remove after testing
// Deletes every expense and income entry. Categories and settings are kept.
// Archived (hidden) categories are removed too, because nothing uses them anymore.
export async function clearAllTransactions(db) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM transactions');
    await db.runAsync('DELETE FROM categories WHERE is_archived = 1');
    await db.runAsync("DELETE FROM sqlite_sequence WHERE name = 'transactions'");
  });
  console.log('All transactions cleared (test helper)');
}

// TEMPORARY TEST HELPER - remove after testing
// Completely resets the app to a brand new install state:
// wipes all transactions, categories, and settings, and re-seeds only DEFAULT_CATEGORIES.
export async function resetEntireApp(db) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM transactions');
    await db.runAsync('DELETE FROM categories');
    await db.runAsync('DELETE FROM settings');
    await db.runAsync("DELETE FROM sqlite_sequence WHERE name = 'transactions'");
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
