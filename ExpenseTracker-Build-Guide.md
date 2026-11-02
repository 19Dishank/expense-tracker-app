# Expense Tracker: Complete Build Guide

Personal Android expense tracker. Expo (React Native), plain JavaScript, local SQLite, INR, custom salary period (15th to 14th).

This guide gives you **every file in full**, tells you **where it goes**, and explains **how it works**. Build it in order. Each step ends with a checkpoint that tells you what you should see on your phone.

> If you already created some files from earlier messages (Step 1 test screen, or the Step 2 files I sent before), **overwrite them** with the versions in this guide. This guide is the final version and replaces everything.

---

## 0. What you are building

| Feature | How it is done |
|---|---|
| Data storage | SQLite database on the phone (`expo-sqlite`). No login, no internet. |
| Money | Stored as whole numbers in **paise** (₹1 = 100 paise). This avoids decimal bugs like 0.1 + 0.2. |
| Salary period | A period runs from your start day to the day before the next start day. Start day 15 gives 15 Jan to 14 Feb. |
| New period | Dashboard is empty. Nothing carries over. The leftover (income minus expense) is that period's **savings** in History. |
| Income | Amount, free-text source (Salary, Freelance, Gift...), date, optional note. |
| Expense | Amount, category, date, optional note. |
| Categories | Add, rename, change icon and color, reorder, delete. |
| Dashboard | Donut chart, category grid (tap to quick add), recent entries, balance bar, Expense and Income buttons. |
| History | All periods with income, expense, savings. Tap one for category totals and every entry (edit or delete). |
| Settings | Change start day, manage categories. |

### Final folder structure

```
ExpenseTracker/
├── App.js
├── app.json
└── src/
    ├── components/
    │   ├── AddTransactionModal.js
    │   ├── CategoryEditModal.js
    │   ├── DayPicker.js
    │   ├── DonutChart.js
    │   ├── SummaryRow.js
    │   └── TransactionRow.js
    ├── constants/
    │   ├── defaultCategories.js
    │   ├── iconList.js
    │   └── theme.js
    ├── context/
    │   └── AppContext.js
    ├── db/
    │   └── database.js
    ├── navigation/
    │   └── AppNavigator.js
    ├── screens/
    │   ├── DashboardScreen.js
    │   ├── HistoryScreen.js
    │   ├── ManageCategoriesScreen.js
    │   ├── PeriodDetailScreen.js
    │   ├── SettingsScreen.js
    │   └── SetupScreen.js
    └── utils/
        ├── confirm.js
        ├── money.js
        └── period.js
```

### Build order

| Step | What | You will see |
|---|---|---|
| 1 | Foundation: install packages, theme, constants, database, helpers | App still runs, no errors |
| 2 | Setup screen, navigation, donut chart, dashboard (display only) | Start-day screen, then dashboard with 3 tabs |
| 3 | Quick add, recent entries, edit and delete | You can add and edit real entries |
| 4 | Category management | Add, edit, reorder, delete categories |
| 5 | History and period detail | Past periods with savings and every entry |
| 6 | Settings and polish | Change start day, final checks |

---

## 1. Concepts you need (read once)

You said you are new to React Native, so here is the short version of every idea used in this app.

**Component.** A JavaScript function that returns UI. `function DashboardScreen() { return (<View>...</View>); }`. Every screen and every reusable piece (donut, modal, row) is a component.

**View, Text, TextInput, TouchableOpacity, ScrollView, FlatList, Modal.** The React Native building blocks. `View` is a box (like a div), `Text` shows text (text must always be inside `Text`), `TextInput` is an input, `TouchableOpacity` is a tappable area, `ScrollView` scrolls, `FlatList` is an efficient long list, `Modal` is a layer shown above the screen.

**StyleSheet and Flexbox.** Styles are JavaScript objects. Layout uses flexbox: `flexDirection: 'row'` puts children side by side, `justifyContent` aligns along the main direction, `alignItems` aligns across it, `flex: 1` means "take all remaining space".

**Props.** Inputs to a component, like function arguments. `<TransactionRow item={x} onPress={fn} />` passes `item` and `onPress`.

**useState.** Memory for a component. `const [amount, setAmount] = useState('')` creates a value and a function to change it. Changing it redraws the screen.

**useEffect.** Runs code after the screen draws, or when listed values change. Used to reset the form when a modal opens.

**useCallback.** Keeps a function from being re-created on every draw. We use it so `useFocusEffect` does not run in a loop.

**useFocusEffect.** From React Navigation. Runs every time a screen becomes visible. We use it to reload data when you come back to a screen.

**Context.** A way to share a value with every screen without passing props. `AppContext` shares the period start day.

**async / await.** Database calls take time. `await` waits for the result. A function using `await` must be marked `async`.

**SQL with `?`.** `db.runAsync('INSERT ... VALUES (?, ?)', [a, b])`. The `?` marks are filled from the array. Never build SQL by joining strings, because that allows SQL injection and breaks on quotes.

**Paise.** The user types `250.50` rupees. We store `25050`. We convert back only when displaying.

**Date strings.** Dates are stored as text `'2026-10-15'`. They sort correctly as text, so `date >= '2026-10-15' AND date <= '2026-11-14'` works. We use the phone's local date (never `toISOString`, which uses UTC and can shift the day).

**console.log.** Prints to the terminal running `npx expo start`. Every important action logs something so you can debug.

---

# STEP 1: Foundation

## 1.1 Install packages

Run in the project folder (the one containing `package.json`):

```bash
npx expo install expo-sqlite @expo/vector-icons react-native-svg @react-native-community/datetimepicker react-native-safe-area-context react-native-screens @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack
```

`npx expo install` picks versions that match your Expo SDK. Do not use plain `npm install` for these.

| Package | Used for |
|---|---|
| `expo-sqlite` | Database on the phone |
| `@expo/vector-icons` | Icons (MaterialCommunityIcons) |
| `react-native-svg` | Drawing the donut chart |
| `@react-native-community/datetimepicker` | Date picker dialog |
| `react-native-safe-area-context` | Keeps content out of the status bar and gesture area |
| `react-native-screens` | Required by React Navigation |
| `@react-navigation/*` | Tabs and stack navigation |

Create these folders inside the project: `src/components`, `src/constants`, `src/context`, `src/db`, `src/navigation`, `src/screens`, `src/utils`.

## 1.2 `src/constants/theme.js` (new)

All colors, spacing and corner sizes live here, so the whole app looks consistent. Change one value here and every screen follows.

```js
// Central place for colors, spacing and corner radius.
// Spacing uses multiples of 4 so the layout stays consistent.

export const colors = {
  background: '#F7F8FA', // screen background (light grey)
  surface: '#FFFFFF', // cards, sheets
  border: '#E5E7EB', // thin lines
  accent: '#1C1C1E', // main dark color (buttons, selected items)
  text: '#1C1C1E', // normal text
  textMuted: '#6B7280', // secondary text
  income: '#2E9E6B', // green
  expense: '#D9534F', // red
  chip: '#F3F4F6', // light grey for chips and inputs
  overlay: 'rgba(0,0,0,0.4)', // dark layer behind bottom sheets
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 8, md: 12, lg: 16, xl: 24 };

// 16 muted colors for the category color picker
export const CATEGORY_COLORS = [
  '#E8825A', '#D9605F', '#C96B9A', '#9A6FC4',
  '#8A7BD1', '#5C7CBA', '#4F8FD6', '#3F7F9E',
  '#3FA7A0', '#5FAD7A', '#8FAE5A', '#D9A93E',
  '#C98A4B', '#A0785A', '#6E8BA3', '#8C8C8C',
];
```

**How it works.** Plain exported objects. Other files do `import { colors, spacing } from '../constants/theme'` and then write `colors.income` instead of repeating `'#2E9E6B'`.

## 1.3 `src/constants/defaultCategories.js` (already exists, keep unchanged)

```js
// Default expense categories. Icon names come from MaterialCommunityIcons.
// Users can edit, delete and add more later (step 4).
export const DEFAULT_CATEGORIES = [
  { name: 'Food', icon: 'silverware-fork-knife', color: '#E8825A' },
  { name: 'Groceries', icon: 'basket-outline', color: '#5FAD7A' },
  { name: 'Transport', icon: 'bus', color: '#4F8FD6' },
  { name: 'Fuel', icon: 'gas-station-outline', color: '#8A7BD1' },
  { name: 'Rent', icon: 'home-outline', color: '#3F7F9E' },
  { name: 'Bills', icon: 'lightning-bolt-outline', color: '#D9A93E' },
  { name: 'Mobile', icon: 'phone-outline', color: '#6E8BA3' },
  { name: 'Shopping', icon: 'shopping-outline', color: '#C96B9A' },
  { name: 'Health', icon: 'medical-bag', color: '#D9605F' },
  { name: 'Entertainment', icon: 'movie-open-outline', color: '#9A6FC4' },
  { name: 'Travel', icon: 'airplane', color: '#3FA7A0' },
  { name: 'Education', icon: 'school-outline', color: '#5C7CBA' },
  { name: 'Gifts', icon: 'gift-outline', color: '#C9788A' },
  { name: 'Other', icon: 'dots-horizontal-circle-outline', color: '#8C8C8C' },
];
```

**How it works.** Used once, the first time the database is created, to fill the `categories` table. After that the database is the source of truth, so edits in the app never touch this file.

## 1.4 `src/constants/iconList.js` (new)

Icons offered in the category icon picker. The names must exist in MaterialCommunityIcons. If one shows a "?" on your phone, your icon set version does not have it. Just delete that name from the list.

```js
// Icons offered in the category icon picker (MaterialCommunityIcons names).
// The picker search matches against these names, so keep names descriptive.
export const ICON_LIST = [
  // Food and drink
  'silverware-fork-knife', 'food-outline', 'pizza', 'hamburger', 'coffee-outline',
  'glass-cocktail', 'beer-outline', 'cake-variant-outline', 'ice-cream',
  'basket-outline', 'cart-outline', 'food-apple-outline',
  // Transport
  'bus', 'train', 'car', 'taxi', 'motorbike', 'bike', 'gas-station-outline',
  'airplane', 'subway-variant', 'ferry', 'car-wrench', 'parking',
  // Home and bills
  'home-outline', 'sofa-outline', 'bed-outline', 'lightbulb-outline',
  'lightning-bolt-outline', 'water-outline', 'fire', 'wifi', 'television',
  'washing-machine', 'tools', 'hammer-wrench', 'key-outline',
  // Health
  'medical-bag', 'pill', 'hospital-box-outline', 'heart-pulse', 'tooth-outline',
  'eye-outline', 'stethoscope', 'needle', 'bandage',
  // Shopping
  'shopping-outline', 'tshirt-crew-outline', 'shoe-formal', 'hanger',
  'diamond-stone', 'bag-personal-outline', 'store-outline', 'gift-outline', 'sunglasses',
  // Entertainment
  'movie-open-outline', 'gamepad-variant-outline', 'music-note', 'headphones',
  'ticket-outline', 'party-popper', 'camera-outline', 'guitar-acoustic',
  'book-open-variant', 'palette-outline',
  // Travel
  'bag-suitcase-outline', 'map-marker-outline', 'beach', 'bed', 'compass-outline',
  'tent', 'passport', 'earth',
  // Education
  'school-outline', 'book-outline', 'pencil-outline', 'laptop',
  'certificate-outline', 'calculator',
  // Finance
  'bank-outline', 'credit-card-outline', 'cash', 'wallet-outline',
  'piggy-bank-outline', 'chart-line', 'percent-outline', 'receipt',
  'currency-inr', 'hand-coin-outline',
  // Pets
  'paw', 'dog', 'cat', 'fish', 'bone',
  // Kids
  'baby-carriage', 'teddy-bear', 'baby-face-outline', 'toy-brick-outline',
  // Fitness
  'dumbbell', 'run', 'yoga', 'soccer', 'basketball', 'swim', 'tennis', 'weight-lifter',
  // Personal care and other
  'phone-outline', 'cellphone', 'content-cut', 'face-woman-outline', 'lipstick',
  'spray-bottle', 'flower-outline', 'tree-outline', 'briefcase-outline',
  'office-building-outline', 'hand-heart-outline', 'umbrella-outline',
  'cog-outline', 'recycle', 'star-outline', 'heart-outline',
  'dots-horizontal-circle-outline',
];
```

## 1.5 `src/context/AppContext.js` (new)

```js
import { createContext, useContext } from 'react';

// Shares the period start day with every screen.
// App.js fills it in; Settings can change it.
export const AppContext = createContext({
  startDay: 15,
  setStartDay: () => {},
});

// Small helper so screens can write: const { startDay } = useAppContext();
export function useAppContext() {
  return useContext(AppContext);
}
```

**How it works.** `createContext` makes a shared "box". `App.js` puts a value in it with `<AppContext.Provider value={...}>`. Any screen reads it with `useAppContext()`. When Settings calls `setStartDay`, every screen using it redraws with the new value.

## 1.6 `src/utils/confirm.js` (new)

```js
import { Alert } from 'react-native';

// Shows a "Cancel / Delete" dialog. onConfirm runs only if the user taps Delete.
export function confirmDelete(title, message, onConfirm) {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}
```

**How it works.** One shared delete confirmation, so every delete in the app behaves the same. `style: 'destructive'` marks the button as a dangerous action.

## 1.7 `src/utils/money.js` (new)

```js
// Amounts are stored in paise (rupees x 100).

// Largest amount accepted: 9,99,99,999.99 rupees (in paise)
const MAX_PAISE = 9999999999;

// Converts paise to a string like ₹1,23,456.50 (Indian grouping)
export function formatINR(paise) {
  const negative = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rest = abs % 100;

  let text = String(rupees);
  if (text.length > 3) {
    const lastThree = text.slice(-3);
    const others = text.slice(0, -3);
    // Put a comma after every 2 digits in the left part
    text = others.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
  }
  // Show paise only when they exist
  if (rest > 0) {
    text += '.' + String(rest).padStart(2, '0');
  }
  return (negative ? '-' : '') + '₹' + text;
}

// Converts what the user typed ("250.5") into paise (25050).
// Returns null when the input is invalid, zero, negative or too large.
export function rupeesToPaise(input) {
  const cleaned = String(input).replace(/,/g, '').trim();
  // Only digits with an optional dot and 1 or 2 decimals
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return null;
  }
  const paise = Math.round(parseFloat(cleaned) * 100);
  if (paise <= 0 || paise > MAX_PAISE) {
    return null;
  }
  return paise;
}

// Converts paise back to an editable string for the input field (25050 -> "250.5" style)
export function paiseToRupeesString(paise) {
  const rupees = Math.floor(paise / 100);
  const rest = paise % 100;
  if (rest === 0) {
    return String(rupees);
  }
  return rupees + '.' + String(rest).padStart(2, '0');
}

// Whole-number percentage of part in total (0 when total is 0)
export function percentOf(part, total) {
  if (!total) {
    return 0;
  }
  return Math.round((part / total) * 100);
}
```

**How it works.**
- `formatINR`: splits rupees and paise. Indian grouping puts the last 3 digits together and then groups the rest in pairs: `1234567` becomes `12,34,567`. The regex `\B(?=(\d{2})+(?!\d))` means "insert a comma at every position followed by pairs of digits until the end".
- `rupeesToPaise`: the regex `^\d+(\.\d{1,2})?$` accepts `250`, `250.5`, `250.55` and rejects `abc`, `1.234`, `-5`. `Math.round(... * 100)` fixes tiny floating-point errors (for example `19.99 * 100` is `1998.9999999999998`).
- Returns `null` for anything invalid, so the form can show one error message.
- `percentOf` guards against dividing by zero.

## 1.8 `src/utils/period.js` (new)

```js
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
```

**How it works.**
- `getPeriodForDate(15, 20 Jan)`: day 20 is not before 15, so the period starts in January: `start = 15 Jan`. `end = new Date(year, month + 1, 14)` is 14 Feb. JavaScript automatically rolls month 12 into January of the next year, so **15 Dec to 14 Jan** works with no special code.
- Start day 1: `end = new Date(y, m + 1, 0)`. Day 0 means "last day of the previous month", so the period is 1st to the last day of the month.
- Start days are limited to 1 to 28 in the app, so every month contains the start day.
- `getPeriodsBetween` walks forward one period at a time: next period begins the day after `end`.

## 1.9 `src/db/database.js` (replace the whole file)

This is the final version with **every database function the app needs**, so you will not need to edit it again.

```js
import { DEFAULT_CATEGORIES } from '../constants/defaultCategories';
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
  await db.runAsync(
    'INSERT INTO categories (name, icon, color, sort_order) VALUES (?, ?, ?, ?)',
    [name, icon, color, row.next]
  );
  console.log('Category added:', name);
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
```

**How it works, function by function.**
- `initDatabase`: runs on every app start (we pass it to `SQLiteProvider`). `CREATE TABLE IF NOT EXISTS` does nothing if the table exists, so it is safe to run repeatedly. `WAL` mode makes writes faster and safer.
- **Migration**: your phone already has a `categories` table from Step 1 without `is_archived`. `PRAGMA table_info` lists the columns. If the column is missing we add it with `ALTER TABLE`. Existing categories get `0` (not archived).
- `getSetting / setSetting`: a tiny key-value store. `ON CONFLICT ... DO UPDATE` means "insert, or update if the key exists".
- `archiveOrDeleteCategory`: counts entries using that category. If any exist it only sets `is_archived = 1`, so old entries keep their name, icon and color. If none exist the row is removed.
- `reorderCategories`: rewrites `sort_order` as 0, 1, 2... in the new order, inside one database transaction so it is all-or-nothing.
- `getTransactionsForPeriod`: `LEFT JOIN` attaches the category name, icon and color to each entry. Income entries have no category, so those columns are `null`.
- `getPeriodTotals`: one query returns both sums. `CASE WHEN type='income' THEN amount END` adds only income rows. `COALESCE(..., 0)` turns "no rows" (null) into 0.
- `getCategoryTotals`: starts from the categories table so categories with zero spending still appear (`LEFT JOIN`). The `HAVING` line keeps active categories always, and archived ones only if they have spending in the range.
- `getAllPeriods`: finds the oldest and newest entry dates, always includes the current period, builds every period in between, and computes savings = income minus expense. Periods are **calculated**, not stored, so changing the start day recalculates history automatically.

**Checkpoint (Step 1).** Run `npx expo start -c` and reload. Your temporary Step 1 screen should still show the 14 categories with no red error screen. If you see an error, read it: a missing import usually means a file is in the wrong folder.

---

# STEP 2: Setup screen, navigation, dashboard (display only)

## 2.1 `src/components/DonutChart.js` (new)

```js
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

// data = [{ id, value, color }]
// children are shown in the center of the donut
export default function DonutChart({ data, size = 240, strokeWidth = 28, children }) {
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((sum, item) => sum + item.value, 0);

  let usedLength = 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Rotate so the first slice starts at the top */}
        <G rotation="-90" origin={`${center}, ${center}`}>
          {/* Grey background ring (also the empty state) */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#E9ECEF"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {total > 0 &&
            data.map((item) => {
              const sliceLength = (item.value / total) * circumference;
              const circle = (
                <Circle
                  key={item.id}
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={item.color}
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeDasharray={`${sliceLength} ${circumference - sliceLength}`}
                  strokeDashoffset={-usedLength}
                />
              );
              usedLength += sliceLength;
              return circle;
            })}
        </G>
      </Svg>
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
});
```

**How it works.** A donut is a circle drawn with a thick outline. A circle's outline length is `2 × π × radius` (the *circumference*). Each slice is the same circle drawn with a **dashed** outline: `strokeDasharray="A B"` means "draw A, then leave a gap of B". For a slice that is 25% of the total, A is 25% of the circumference and B is the rest. `strokeDashoffset` slides the dash start, so each slice begins where the previous one ended (`usedLength`). Rotating the group by -90° makes the first slice start at 12 o'clock instead of 3 o'clock. When there is no data, only the grey ring shows. The `center` style layers your content (the spent amount) exactly over the middle using `absoluteFillObject`.

## 2.2 `src/components/DayPicker.js` (new)

```js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius } from '../constants/theme';

// Days 1 to 28 (28 max so every month has that day)
const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

// Grid of day buttons. Used on the setup screen and in Settings.
export default function DayPicker({ selectedDay, onSelect }) {
  return (
    <View style={styles.grid}>
      {DAYS.map((day) => {
        const selected = day === selectedDay;
        return (
          <View key={day} style={styles.cell}>
            <TouchableOpacity
              style={[styles.day, selected && styles.daySelected]}
              onPress={() => onSelect(day)}
              activeOpacity={0.7}
              accessibilityLabel={`Day ${day}`}
            >
              <Text style={[styles.dayText, selected && styles.dayTextSelected]}>{day}</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  // 7 columns: each cell is 1/7 of the width and square
  cell: { width: '14.2857%', aspectRatio: 1, padding: 3 },
  day: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.chip,
  },
  daySelected: { backgroundColor: colors.accent },
  dayText: { fontSize: 16, color: colors.text },
  dayTextSelected: { color: '#FFFFFF', fontWeight: '600' },
});
```

**How it works.** `Array.from({ length: 28 }, (_, i) => i + 1)` builds `[1, 2, ... 28]`. `flexWrap: 'wrap'` with cells 14.2857% wide (1/7) gives 7 columns. The component does not remember the selection itself: the parent passes `selectedDay` and gets told about taps through `onSelect`. That is why the same picker works in two places.

## 2.3 `src/screens/SetupScreen.js` (new)

```js
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import DayPicker from '../components/DayPicker';
import { setSetting } from '../db/database';
import { getPeriodForDate } from '../utils/period';
import { colors, spacing, radius } from '../constants/theme';

// Shown only on the very first launch
export default function SetupScreen({ onDone }) {
  const db = useSQLiteContext();
  const [selectedDay, setSelectedDay] = useState(15);

  // Shows the user what their current period would look like
  const preview = getPeriodForDate(selectedDay);

  async function handleContinue() {
    console.log('Saving period start day:', selectedDay);
    await setSetting(db, 'period_start_day', selectedDay);
    onDone(selectedDay);
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>When does your month start?</Text>
      <Text style={styles.sub}>
        Pick the day your salary arrives. Each period runs from this day to the day before the next
        one. You can change it later in Settings.
      </Text>

      <View style={styles.pickerWrap}>
        <DayPicker selectedDay={selectedDay} onSelect={setSelectedDay} />
      </View>

      <Text style={styles.example}>Your current period would be {preview.fullLabel}.</Text>

      <TouchableOpacity style={styles.button} onPress={handleContinue} activeOpacity={0.8}>
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, padding: spacing.xl },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, marginTop: spacing.xl },
  sub: { fontSize: 15, color: colors.textMuted, marginTop: spacing.md, lineHeight: 22 },
  pickerWrap: { marginTop: spacing.xl },
  example: { fontSize: 14, color: colors.textMuted, marginTop: spacing.lg },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
```

**How it works.**
- `useSQLiteContext()` gives the open database (provided by `SQLiteProvider` in `App.js`).
- `useState(15)` starts with 15 selected, your salary day.
- `handleContinue` saves the day in the `settings` table and calls `onDone(selectedDay)`. `App.js` passes `setStartDay` as `onDone`, so the app immediately switches to the dashboard.
- `marginTop: 'auto'` pushes the button to the bottom of the screen.
- `SafeAreaView` (from `react-native-safe-area-context`) adds padding for the status bar and gesture bar.

## 2.4 `src/screens/DashboardScreen.js` (new, Step 2 version)

This is a **display-only** version. Taps just print to the console. In Step 3 you will replace this whole file.

```js
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DonutChart from '../components/DonutChart';
import { useAppContext } from '../context/AppContext';
import { colors, spacing, radius } from '../constants/theme';
import { getPeriodForDate } from '../utils/period';
import { formatINR, percentOf } from '../utils/money';
import { getPeriodTotals, getCategoryTotals } from '../db/database';

export default function DashboardScreen() {
  const db = useSQLiteContext();
  const { startDay } = useAppContext();

  const [period, setPeriod] = useState(() => getPeriodForDate(startDay));
  const [totals, setTotals] = useState({ income: 0, expense: 0 });
  const [categoryTotals, setCategoryTotals] = useState([]);

  // Loads everything the dashboard shows
  const load = useCallback(async () => {
    const p = getPeriodForDate(startDay);
    const t = await getPeriodTotals(db, p.start, p.end);
    const c = await getCategoryTotals(db, p.start, p.end);
    setPeriod(p);
    setTotals(t);
    setCategoryTotals(c);
  }, [db, startDay]);

  // Reload every time this screen becomes visible
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const balance = totals.income - totals.expense;

  // Only categories with spending appear in the donut (archived ones too)
  const donutData = categoryTotals
    .filter((c) => c.total > 0)
    .map((c) => ({ id: c.id, value: c.total, color: c.color }));

  // The grid shows only active categories
  const gridCategories = categoryTotals.filter((c) => !c.is_archived);

  function handleCategoryPress(category) {
    // Quick add comes in step 3
    console.log('Category tapped:', category.name);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Current period</Text>
        <Text style={styles.headerPeriod}>{period.label}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Donut */}
        <View style={styles.donutWrapper}>
          <DonutChart data={donutData} size={240} strokeWidth={28}>
            <Text style={styles.donutLabel}>Spent</Text>
            <Text style={styles.donutAmount} numberOfLines={1} adjustsFontSizeToFit>
              {formatINR(totals.expense)}
            </Text>
            <Text style={styles.donutIncome} numberOfLines={1} adjustsFontSizeToFit>
              Income {formatINR(totals.income)}
            </Text>
          </DonutChart>
        </View>

        {/* Category grid */}
        <View style={styles.grid}>
          {gridCategories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={styles.gridItem}
              onPress={() => handleCategoryPress(cat)}
              activeOpacity={0.7}
              accessibilityLabel={`Add expense to ${cat.name}`}
            >
              <View style={[styles.iconCircle, { backgroundColor: cat.color + '1F' }]}>
                <MaterialCommunityIcons name={cat.icon} size={26} color={cat.color} />
              </View>
              <Text style={styles.catName} numberOfLines={1}>
                {cat.name}
              </Text>
              <Text style={styles.catTotal} numberOfLines={1}>
                {cat.total > 0 ? formatINR(cat.total) : ' '}
              </Text>
              <Text style={styles.catPercent}>
                {cat.total > 0 ? percentOf(cat.total, totals.expense) + '%' : ' '}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Remaining balance</Text>
          <Text style={[styles.balanceAmount, balance < 0 && styles.balanceNegative]}>
            {formatINR(balance)}
          </Text>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.expenseButton]}
            onPress={() => console.log('Expense button tapped')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="minus" size={22} color="#FFFFFF" />
            <Text style={styles.actionText}>Expense</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.incomeButton]}
            onPress={() => console.log('Income button tapped')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
            <Text style={styles.actionText}>Income</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xs },
  headerLabel: { fontSize: 13, color: colors.textMuted },
  headerPeriod: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 2 },

  scrollContent: { paddingBottom: spacing.lg },

  donutWrapper: { alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.xl },
  donutLabel: { fontSize: 13, color: colors.textMuted },
  donutAmount: { fontSize: 26, fontWeight: '700', color: colors.text, marginTop: 2 },
  donutIncome: { fontSize: 13, color: colors.income, marginTop: spacing.xs },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.sm },
  gridItem: { width: '25%', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.xs },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  catName: { fontSize: 12, color: colors.text, marginTop: spacing.sm },
  catTotal: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  catPercent: { fontSize: 11, color: colors.textMuted },

  bottomBar: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    elevation: 8,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  balanceLabel: { fontSize: 14, color: colors.textMuted },
  balanceAmount: { fontSize: 20, fontWeight: '700', color: colors.text },
  balanceNegative: { color: colors.expense },

  buttonRow: { flexDirection: 'row', gap: spacing.md },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  expenseButton: { backgroundColor: colors.expense },
  incomeButton: { backgroundColor: colors.income },
  actionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
```

**How it works.**
- `period` is kept in state and recalculated inside `load`. This way, if you leave the app open past midnight on the 14th and come back, the period updates when the screen is focused again.
- `useFocusEffect(useCallback(() => { load(); }, [load]))`: runs `load` every time the Dashboard tab becomes visible. It is wrapped so the effect function itself is not `async` (React Navigation expects it to return nothing).
- `load` reads totals and category totals from the database and puts them into state. Changing state redraws the screen.
- `donutData`: builds the `{ id, value, color }` list the donut expects, only for categories with spending.
- `cat.color + '1F'` adds a hex alpha, turning `#E8825A` into a 12% transparent version for the soft circle behind the icon.
- `balance = income - expense`. If negative, the text turns red (`balanceNegative` is applied only when `balance < 0`).
- `adjustsFontSizeToFit` with `numberOfLines={1}` shrinks very large amounts so they fit inside the donut.
- `edges={['top']}`: the bottom tab bar already handles the bottom safe area.

## 2.5 Placeholder screens (create four small files)

These keep the navigator working until we build the real screens. Each will be **overwritten** in a later step.

`src/screens/HistoryScreen.js`
```js
import React from 'react';
import { View, Text } from 'react-native';

// Placeholder, replaced in Step 5
export default function HistoryScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>History (coming in Step 5)</Text>
    </View>
  );
}
```

`src/screens/PeriodDetailScreen.js`
```js
import React from 'react';
import { View, Text } from 'react-native';

// Placeholder, replaced in Step 5
export default function PeriodDetailScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Period detail (coming in Step 5)</Text>
    </View>
  );
}
```

`src/screens/SettingsScreen.js`
```js
import React from 'react';
import { View, Text } from 'react-native';

// Placeholder, replaced in Step 6
export default function SettingsScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Settings (coming in Step 6)</Text>
    </View>
  );
}
```

`src/screens/ManageCategoriesScreen.js`
```js
import React from 'react';
import { View, Text } from 'react-native';

// Placeholder, replaced in Step 4
export default function ManageCategoriesScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Manage categories (coming in Step 4)</Text>
    </View>
  );
}
```

## 2.6 `src/navigation/AppNavigator.js` (new)

```js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../constants/theme';
import DashboardScreen from '../screens/DashboardScreen';
import HistoryScreen from '../screens/HistoryScreen';
import PeriodDetailScreen from '../screens/PeriodDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ManageCategoriesScreen from '../screens/ManageCategoriesScreen';

const Tab = createBottomTabNavigator();
const HistoryStack = createNativeStackNavigator();
const SettingsStack = createNativeStackNavigator();

// Header look shared by both stacks
const stackOptions = {
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.background },
  headerTitleStyle: { color: colors.text, fontWeight: '600' },
  headerTintColor: colors.text,
  contentStyle: { backgroundColor: colors.background },
};

// History tab: list of periods -> detail of one period
function HistoryNavigator() {
  return (
    <HistoryStack.Navigator screenOptions={stackOptions}>
      <HistoryStack.Screen name="HistoryList" component={HistoryScreen} options={{ title: 'History' }} />
      <HistoryStack.Screen name="PeriodDetail" component={PeriodDetailScreen} options={{ title: 'Period' }} />
    </HistoryStack.Navigator>
  );
}

// Settings tab: settings -> manage categories
function SettingsNavigator() {
  return (
    <SettingsStack.Navigator screenOptions={stackOptions}>
      <SettingsStack.Screen name="SettingsHome" component={SettingsScreen} options={{ title: 'Settings' }} />
      <SettingsStack.Screen
        name="ManageCategories"
        component={ManageCategoriesScreen}
        options={{ title: 'Categories' }}
      />
    </SettingsStack.Navigator>
  );
}

// Icon for each tab
function tabIcon(name) {
  return ({ color, size }) => <MaterialCommunityIcons name={name} size={size} color={color} />;
}

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 12 },
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarIcon: tabIcon('view-dashboard-outline') }} />
      <Tab.Screen name="History" component={HistoryNavigator} options={{ tabBarIcon: tabIcon('history') }} />
      <Tab.Screen name="Settings" component={SettingsNavigator} options={{ tabBarIcon: tabIcon('cog-outline') }} />
    </Tab.Navigator>
  );
}
```

**How it works.** The bottom tab navigator has three tabs. The History and Settings tabs each contain a **stack**: a stack lets you push a second screen on top (period detail, manage categories) with an automatic back button and the Android back gesture. `headerShown: false` on the tabs avoids a double header, because the stacks draw their own. The Dashboard draws its own header inside the screen. `tabIcon('history')` returns a small function that React Navigation calls with the current color and size.

## 2.7 `App.js` (replace the whole file)

```js
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { initDatabase, getSetting } from './src/db/database';
import { AppContext } from './src/context/AppContext';
import SetupScreen from './src/screens/SetupScreen';
import AppNavigator from './src/navigation/AppNavigator';
import { colors } from './src/constants/theme';

// Navigation colors match our theme
const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.background, card: colors.surface },
};

// Decides which screen to show: setup (first launch) or the main app
function Root() {
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(true);
  const [startDay, setStartDay] = useState(null);

  useEffect(() => {
    async function load() {
      const saved = await getSetting(db, 'period_start_day');
      console.log('Saved period start day:', saved);
      if (saved) {
        setStartDay(parseInt(saved, 10));
      }
      setLoading(false);
    }
    load();
  }, [db]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  // First launch: ask for the start day
  if (!startDay) {
    return <SetupScreen onDone={setStartDay} />;
  }

  return (
    <AppContext.Provider value={{ startDay, setStartDay }}>
      <NavigationContainer theme={navTheme}>
        <AppNavigator />
      </NavigationContainer>
    </AppContext.Provider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SQLiteProvider databaseName="expense.db" onInit={initDatabase}>
        <Root />
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
```

**How it works.**
- `App` wraps everything in providers: safe-area info, then the database. `onInit={initDatabase}` runs table creation before any screen opens.
- `Root` reads the saved start day once. While reading, it shows a spinner. If nothing is saved it shows `SetupScreen`. Otherwise it shows the real app inside `AppContext.Provider`, so every screen can read and change `startDay`.
- `parseInt(saved, 10)`: settings are stored as text, so convert back to a number.

**Checkpoint (Step 2).** Run `npx expo start -c`.
1. First screen: "When does your month start?" with 15 selected and a preview such as "15 Oct 2026 - 14 Nov 2026". Tap Continue.
2. Dashboard: header with the period label, empty grey donut with ₹0, 14 category icons, balance bar showing ₹0, Expense and Income buttons, three bottom tabs.
3. Tap a category: the terminal prints `Category tapped: Food`.
4. History and Settings tabs show placeholder text.

To see the setup screen again, clear Expo Go's storage or change the `databaseName` in `App.js` (for example to `expense2.db`).

---

# STEP 3: Quick add, recent entries, edit and delete

You will create two new components, then replace `DashboardScreen.js` with the full version.

## 3.1 `src/components/TransactionRow.js` (new)

One row in an entries list. Used on the Dashboard and in Period Detail.

```js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing } from '../constants/theme';
import { formatINR } from '../utils/money';
import { formatDisplayDate } from '../utils/period';

// item comes from getTransactionsForPeriod (it includes category_name, category_icon, category_color)
export default function TransactionRow({ item, onPress, onLongPress, isLast }) {
  const isExpense = item.type === 'expense';

  // Expenses show the category icon, income shows a cash icon
  const iconName = isExpense ? item.category_icon || 'help-circle-outline' : 'cash-plus';
  const iconColor = isExpense ? item.category_color || colors.textMuted : colors.income;
  const title = isExpense ? item.category_name || 'Uncategorized' : item.source || 'Income';
  const subtitle = formatDisplayDate(item.date) + (item.note ? ' · ' + item.note : '');
  const sign = isExpense ? '-' : '+';

  return (
    <TouchableOpacity
      style={[styles.row, !isLast && styles.divider]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconCircle, { backgroundColor: iconColor + '1F' }]}>
        <MaterialCommunityIcons name={iconName} size={22} color={iconColor} />
      </View>

      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      <Text style={[styles.amount, { color: isExpense ? colors.expense : colors.income }]}>
        {sign + formatINR(item.amount)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingVertical: spacing.sm,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  middle: { flex: 1, marginHorizontal: spacing.md },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '600' },
});
```

**How it works.**
- It does no database work. The parent gives it an `item` and two functions: `onPress` (tap = edit) and `onLongPress` (hold = delete).
- `isLast` removes the thin divider line under the last row.
- The `||` fallbacks protect against missing data (for example `null` category name).
- `middle` has `flex: 1`, so long notes get cut with "..." (`numberOfLines={1}`) instead of pushing the amount off screen.

## 3.2 `src/components/AddTransactionModal.js` (new)

The bottom sheet used for **every** add and edit. It works in four modes:

| How it is opened | Props |
|---|---|
| Tap a category | `type="expense"`, `presetCategoryId=<id>` |
| Expense button | `type="expense"`, no preset (shows category chooser) |
| Income button | `type="income"` (shows source field and chips) |
| Tap an existing entry | `editing=<entry>` (fields filled, Delete button shown) |

```js
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  StyleSheet,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { colors, spacing, radius } from '../constants/theme';
import { rupeesToPaise, paiseToRupeesString } from '../utils/money';
import { toDateString, parseDateString, formatDisplayDate } from '../utils/period';
import { confirmDelete } from '../utils/confirm';
import { addTransaction, updateTransaction, deleteTransaction } from '../db/database';

export default function AddTransactionModal({
  visible,
  type, // 'expense' or 'income'
  categories, // active categories for the chooser
  incomeSources, // previously used income sources (array of text)
  presetCategoryId, // category chosen by tapping it on the dashboard (or null)
  editing, // the entry being edited (or null when adding)
  onClose,
  onSaved,
}) {
  const db = useSQLiteContext();
  const isExpense = type === 'expense';

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date());
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [source, setSource] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Every time the sheet opens, fill the fields (edit mode) or clear them (add mode)
  useEffect(() => {
    if (!visible) {
      return;
    }
    setErrors({});
    setShowPicker(false);
    setSaving(false);
    if (editing) {
      setAmount(paiseToRupeesString(editing.amount));
      setDate(parseDateString(editing.date));
      setNote(editing.note || '');
      setCategoryId(editing.category_id);
      setSource(editing.source || '');
    } else {
      setAmount('');
      setDate(new Date());
      setNote('');
      setCategoryId(presetCategoryId || null);
      setSource('');
    }
  }, [visible, editing, presetCategoryId]);

  // If we edit an entry whose category was archived, keep that category in the chooser
  let chooserList = categories;
  if (
    editing &&
    isExpense &&
    editing.category_id &&
    !categories.some((c) => c.id === editing.category_id)
  ) {
    chooserList = [
      {
        id: editing.category_id,
        name: editing.category_name,
        icon: editing.category_icon,
        color: editing.category_color,
      },
      ...categories,
    ];
  }

  const presetCategory = categories.find((c) => c.id === presetCategoryId);
  // The chooser is hidden when the user came by tapping a category
  const showChooser = isExpense && !presetCategoryId;

  let title = isExpense ? 'Add expense' : 'Add income';
  if (editing) {
    title = isExpense ? 'Edit expense' : 'Edit income';
  } else if (presetCategory) {
    title = presetCategory.name;
  }

  function pickQuickDate(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    setDate(d);
  }

  async function handleSave() {
    const newErrors = {};
    const paise = rupeesToPaise(amount);
    if (paise === null) {
      newErrors.amount = 'Enter an amount from 0.01 up to 9,99,99,999';
    }
    if (isExpense && !categoryId) {
      newErrors.category = 'Choose a category';
    }
    if (!isExpense && source.trim() === '') {
      newErrors.source = 'Enter where this income came from';
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }

    const data = {
      type,
      amount: paise,
      categoryId: isExpense ? categoryId : null,
      source: isExpense ? null : source.trim(),
      note: note.trim() === '' ? null : note.trim(),
      date: toDateString(date),
    };

    setSaving(true);
    try {
      if (editing) {
        await updateTransaction(db, editing.id, data);
      } else {
        await addTransaction(db, data);
      }
      onSaved();
    } catch (e) {
      console.log('Save failed:', e);
      setErrors({ general: 'Could not save. Please try again.' });
      setSaving(false);
    }
  }

  function handleDelete() {
    confirmDelete('Delete entry', 'This entry will be removed permanently.', async () => {
      await deleteTransaction(db, editing.id);
      onSaved();
    });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior="padding">
        {/* Tapping the dark area closes the sheet */}
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {presetCategory && !editing && (
                <View style={[styles.headerIcon, { backgroundColor: presetCategory.color + '1F' }]}>
                  <MaterialCommunityIcons name={presetCategory.icon} size={20} color={presetCategory.color} />
                </View>
              )}
              <Text style={styles.title}>{title}</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityLabel="Close">
              <MaterialCommunityIcons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Amount */}
            <View style={styles.amountRow}>
              <Text style={styles.rupee}>₹</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ''))}
                placeholder="0"
                placeholderTextColor={colors.border}
                keyboardType="decimal-pad"
                autoFocus
                maxLength={13}
              />
            </View>
            {errors.amount && <Text style={styles.error}>{errors.amount}</Text>}

            {/* Category chooser (expense without a preset category) */}
            {showChooser && (
              <View style={styles.section}>
                <Text style={styles.label}>Category</Text>
                <View style={styles.chipWrap}>
                  {chooserList.map((cat) => {
                    const selected = cat.id === categoryId;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.catChip,
                          selected && { backgroundColor: cat.color + '1F', borderColor: cat.color },
                        ]}
                        onPress={() => setCategoryId(cat.id)}
                        activeOpacity={0.7}
                      >
                        <MaterialCommunityIcons name={cat.icon} size={18} color={cat.color} />
                        <Text style={styles.catChipText}>{cat.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {errors.category && <Text style={styles.error}>{errors.category}</Text>}
              </View>
            )}

            {/* Source (income) */}
            {!isExpense && (
              <View style={styles.section}>
                <Text style={styles.label}>Source</Text>
                <TextInput
                  style={styles.input}
                  value={source}
                  onChangeText={setSource}
                  placeholder="Salary, Freelance, Gift..."
                  placeholderTextColor={colors.textMuted}
                  maxLength={30}
                />
                {incomeSources.length > 0 && (
                  <View style={[styles.chipWrap, { marginTop: spacing.sm }]}>
                    {incomeSources.map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={[styles.sourceChip, s === source && styles.sourceChipSelected]}
                        onPress={() => setSource(s)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.sourceChipText, s === source && styles.sourceChipTextSelected]}>
                          {s}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {errors.source && <Text style={styles.error}>{errors.source}</Text>}
              </View>
            )}

            {/* Date */}
            <View style={styles.section}>
              <Text style={styles.label}>Date</Text>
              <TouchableOpacity style={styles.dateRow} onPress={() => setShowPicker(true)} activeOpacity={0.7}>
                <MaterialCommunityIcons name="calendar-month-outline" size={20} color={colors.text} />
                <Text style={styles.dateText}>{formatDisplayDate(toDateString(date))}</Text>
              </TouchableOpacity>
              <View style={[styles.chipWrap, { marginTop: spacing.sm }]}>
                <TouchableOpacity style={styles.sourceChip} onPress={() => pickQuickDate(0)}>
                  <Text style={styles.sourceChipText}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.sourceChip} onPress={() => pickQuickDate(1)}>
                  <Text style={styles.sourceChipText}>Yesterday</Text>
                </TouchableOpacity>
              </View>
              {showPicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="default"
                  onChange={(event, selected) => {
                    // On Android the dialog closes itself; hide our flag too
                    setShowPicker(false);
                    if (event.type === 'set' && selected) {
                      setDate(selected);
                    }
                  }}
                />
              )}
            </View>

            {/* Note */}
            <View style={styles.section}>
              <Text style={styles.label}>Note (optional)</Text>
              <TextInput
                style={styles.input}
                value={note}
                onChangeText={setNote}
                placeholder="Add a note"
                placeholderTextColor={colors.textMuted}
                maxLength={100}
              />
            </View>

            {errors.general && <Text style={styles.error}>{errors.general}</Text>}

            {/* Buttons */}
            <TouchableOpacity
              style={[styles.saveButton, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={styles.saveText}>{editing ? 'Save changes' : 'Save'}</Text>
            </TouchableOpacity>

            {editing && (
              <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} activeOpacity={0.7}>
                <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.expense} />
                <Text style={styles.deleteText}>Delete entry</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  backdrop: { flex: 1 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.xl,
    paddingRight: spacing.sm,
    paddingTop: spacing.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  closeButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },

  amountRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  rupee: { fontSize: 32, fontWeight: '700', color: colors.textMuted, marginRight: spacing.sm },
  amountInput: { flex: 1, fontSize: 32, fontWeight: '700', color: colors.text, paddingVertical: spacing.sm },

  section: { marginTop: spacing.lg },
  label: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.chip,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    fontSize: 16,
    color: colors.text,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.chip,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  catChipText: { fontSize: 14, color: colors.text },
  sourceChip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.chip,
  },
  sourceChipSelected: { backgroundColor: colors.accent },
  sourceChipText: { fontSize: 14, color: colors.text },
  sourceChipTextSelected: { color: '#FFFFFF' },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.chip,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  dateText: { fontSize: 16, color: colors.text },
  error: { color: colors.expense, fontSize: 13, marginTop: spacing.sm },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    marginTop: spacing.sm,
  },
  deleteText: { color: colors.expense, fontSize: 15, fontWeight: '600' },
});
```

**How it works, section by section.**
1. **Props.** The parent decides everything: what mode, which categories, what to do after saving. The modal only handles the form and the database write.
2. **State.** One `useState` per field. `errors` is an object like `{ amount: '...' }`, and a message appears under a field only if that key exists.
3. **Reset effect.** `useEffect` runs when `visible`, `editing` or `presetCategoryId` change. When the sheet opens it fills the form from `editing` (edit mode) or clears it (add mode, with today's date and the preset category).
4. **`chooserList`.** If you edit an old expense whose category was archived, the category is not in the active list. We add it to the top of the chooser so the entry can still be edited without losing its category.
5. **`showChooser`.** If you opened the sheet by tapping a category, the category is already known, so the chooser is hidden and the header shows that category's icon and name. That is the "quick add".
6. **Amount input.** `keyboardType="decimal-pad"` shows a number keyboard. `autoFocus` opens the keyboard immediately. `replace(/[^0-9.]/g, '')` strips anything that is not a digit or dot, so letters cannot be typed.
7. **Date.** The date lives as a JavaScript `Date`. Tapping the row shows the Android date dialog. `onChange` fires on OK (`event.type === 'set'`) and on cancel (`'dismissed'`), and only OK updates the date. The Today and Yesterday chips are shortcuts.
8. **`handleSave`.** Validates first and collects messages. If any exist it stops. Otherwise it builds `data`, converting the amount with `rupeesToPaise` and the date with `toDateString`. It calls `updateTransaction` (edit) or `addTransaction` (new). `try/catch` shows a message instead of crashing if the database fails. `saving` disables the button so a double tap cannot save twice.
9. **Android back button.** `onRequestClose={onClose}` closes the sheet when the user presses back.
10. **Keyboard.** `KeyboardAvoidingView behavior="padding"` lifts the sheet above the keyboard. `keyboardShouldPersistTaps="handled"` lets a chip tap work while the keyboard is open.
11. **Delete.** Only shown in edit mode. Uses the shared confirmation dialog first.

## 3.3 `src/screens/DashboardScreen.js` (replace the whole file)

Changes from the Step 2 version: the quick add modal, recent entries with edit and delete, and navigation to the full list.

```js
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DonutChart from '../components/DonutChart';
import AddTransactionModal from '../components/AddTransactionModal';
import TransactionRow from '../components/TransactionRow';
import { useAppContext } from '../context/AppContext';
import { colors, spacing, radius } from '../constants/theme';
import { getPeriodForDate } from '../utils/period';
import { formatINR, percentOf } from '../utils/money';
import { confirmDelete } from '../utils/confirm';
import {
  getPeriodTotals,
  getCategoryTotals,
  getTransactionsForPeriod,
  getIncomeSources,
  deleteTransaction,
} from '../db/database';

// How many recent entries to show on the dashboard
const MAX_RECENT = 8;

export default function DashboardScreen({ navigation }) {
  const db = useSQLiteContext();
  const { startDay } = useAppContext();

  const [period, setPeriod] = useState(() => getPeriodForDate(startDay));
  const [totals, setTotals] = useState({ income: 0, expense: 0 });
  const [categoryTotals, setCategoryTotals] = useState([]);
  const [recent, setRecent] = useState([]);
  const [incomeSources, setIncomeSources] = useState([]);

  // Controls the add/edit sheet
  const [modal, setModal] = useState({
    visible: false,
    type: 'expense',
    presetCategoryId: null,
    editing: null,
  });

  // Loads everything the dashboard shows
  const load = useCallback(async () => {
    const p = getPeriodForDate(startDay);
    const t = await getPeriodTotals(db, p.start, p.end);
    const c = await getCategoryTotals(db, p.start, p.end);
    const tx = await getTransactionsForPeriod(db, p.start, p.end);
    const s = await getIncomeSources(db);
    setPeriod(p);
    setTotals(t);
    setCategoryTotals(c);
    setRecent(tx);
    setIncomeSources(s);
  }, [db, startDay]);

  // Reload every time this screen becomes visible
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const balance = totals.income - totals.expense;

  // Only categories with spending appear in the donut (archived ones too)
  const donutData = categoryTotals
    .filter((c) => c.total > 0)
    .map((c) => ({ id: c.id, value: c.total, color: c.color }));

  // The grid and the chooser show only active categories
  const activeCategories = categoryTotals.filter((c) => !c.is_archived);

  // ----- Opening the sheet in different modes -----
  function openCategory(category) {
    console.log('Category tapped:', category.name);
    setModal({ visible: true, type: 'expense', presetCategoryId: category.id, editing: null });
  }

  function openExpense() {
    console.log('Expense button tapped');
    setModal({ visible: true, type: 'expense', presetCategoryId: null, editing: null });
  }

  function openIncome() {
    console.log('Income button tapped');
    setModal({ visible: true, type: 'income', presetCategoryId: null, editing: null });
  }

  function openEdit(item) {
    console.log('Editing entry:', item.id);
    setModal({ visible: true, type: item.type, presetCategoryId: null, editing: item });
  }

  function closeModal() {
    setModal((m) => ({ ...m, visible: false }));
  }

  // Called by the sheet after a save or delete
  function handleSaved() {
    closeModal();
    load();
  }

  function handleLongPressDelete(item) {
    confirmDelete('Delete entry', `Delete ${formatINR(item.amount)}? This cannot be undone.`, async () => {
      await deleteTransaction(db, item.id);
      load();
    });
  }

  function openFullList() {
    // initial: false keeps the History list underneath so the back button works
    navigation.navigate('History', {
      screen: 'PeriodDetail',
      params: { period: { ...period, isCurrent: true } },
      initial: false,
    });
  }

  const shownRecent = recent.slice(0, MAX_RECENT);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Current period</Text>
        <Text style={styles.headerPeriod}>{period.label}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Donut */}
        <View style={styles.donutWrapper}>
          <DonutChart data={donutData} size={240} strokeWidth={28}>
            <Text style={styles.donutLabel}>Spent</Text>
            <Text style={styles.donutAmount} numberOfLines={1} adjustsFontSizeToFit>
              {formatINR(totals.expense)}
            </Text>
            <Text style={styles.donutIncome} numberOfLines={1} adjustsFontSizeToFit>
              Income {formatINR(totals.income)}
            </Text>
          </DonutChart>
        </View>

        {/* Category grid: tap to quick add */}
        <View style={styles.grid}>
          {activeCategories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={styles.gridItem}
              onPress={() => openCategory(cat)}
              activeOpacity={0.7}
              accessibilityLabel={`Add expense to ${cat.name}`}
            >
              <View style={[styles.iconCircle, { backgroundColor: cat.color + '1F' }]}>
                <MaterialCommunityIcons name={cat.icon} size={26} color={cat.color} />
              </View>
              <Text style={styles.catName} numberOfLines={1}>
                {cat.name}
              </Text>
              <Text style={styles.catTotal} numberOfLines={1}>
                {cat.total > 0 ? formatINR(cat.total) : ' '}
              </Text>
              <Text style={styles.catPercent}>
                {cat.total > 0 ? percentOf(cat.total, totals.expense) + '%' : ' '}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent entries */}
        <View style={styles.recentHeader}>
          <Text style={styles.sectionTitle}>Recent entries</Text>
          {recent.length > MAX_RECENT && (
            <TouchableOpacity onPress={openFullList} style={styles.viewAll}>
              <Text style={styles.viewAllText}>View all ({recent.length})</Text>
            </TouchableOpacity>
          )}
        </View>

        {shownRecent.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No entries in this period yet. Tap a category, or use the Expense and Income buttons below.
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            {shownRecent.map((item, index) => (
              <TransactionRow
                key={item.id}
                item={item}
                isLast={index === shownRecent.length - 1}
                onPress={() => openEdit(item)}
                onLongPress={() => handleLongPressDelete(item)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Remaining balance</Text>
          <Text style={[styles.balanceAmount, balance < 0 && styles.balanceNegative]}>
            {formatINR(balance)}
          </Text>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.expenseButton]}
            onPress={openExpense}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="minus" size={22} color="#FFFFFF" />
            <Text style={styles.actionText}>Expense</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.incomeButton]}
            onPress={openIncome}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
            <Text style={styles.actionText}>Income</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Add / edit sheet */}
      <AddTransactionModal
        visible={modal.visible}
        type={modal.type}
        categories={activeCategories}
        incomeSources={incomeSources}
        presetCategoryId={modal.presetCategoryId}
        editing={modal.editing}
        onClose={closeModal}
        onSaved={handleSaved}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xs },
  headerLabel: { fontSize: 13, color: colors.textMuted },
  headerPeriod: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 2 },

  scrollContent: { paddingBottom: spacing.lg },

  donutWrapper: { alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.xl },
  donutLabel: { fontSize: 13, color: colors.textMuted },
  donutAmount: { fontSize: 26, fontWeight: '700', color: colors.text, marginTop: 2 },
  donutIncome: { fontSize: 13, color: colors.income, marginTop: spacing.xs },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.sm },
  gridItem: { width: '25%', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.xs },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  catName: { fontSize: 12, color: colors.text, marginTop: spacing.sm },
  catTotal: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  catPercent: { fontSize: 11, color: colors.textMuted },

  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  viewAll: { minHeight: 48, justifyContent: 'center' },
  viewAllText: { fontSize: 14, color: colors.textMuted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg,
    padding: spacing.xl,
  },
  emptyText: { fontSize: 14, color: colors.textMuted, lineHeight: 20, textAlign: 'center' },

  bottomBar: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    elevation: 8,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  balanceLabel: { fontSize: 14, color: colors.textMuted },
  balanceAmount: { fontSize: 20, fontWeight: '700', color: colors.text },
  balanceNegative: { color: colors.expense },

  buttonRow: { flexDirection: 'row', gap: spacing.md },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  expenseButton: { backgroundColor: colors.expense },
  incomeButton: { backgroundColor: colors.income },
  actionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
```

**How it works.**
- **One sheet, one state object.** `modal` holds `visible`, `type`, `presetCategoryId` and `editing`. Each `open...` function sets those four values differently. That is the whole difference between quick add, Expense button, Income button and edit.
- **Refresh after every change.** The sheet calls `onSaved`, which closes the sheet and runs `load()`. The donut, grid, balance and recent list all update instantly. Long-press delete also calls `load()`.
- **Long press on an entry** shows the confirmation dialog. **Tap** opens it in the sheet for editing (the sheet also has its own Delete button).
- **"View all"** appears only when there are more than 8 entries. `navigation.navigate('History', { screen: 'PeriodDetail', ... })` jumps into the nested History stack. `initial: false` keeps the History list underneath, so the back button returns there.
- **Percentages.** `percentOf(cat.total, totals.expense)` shows each category's share of total spending under its amount.

**Checkpoint (Step 3).**
1. Tap **Food**: a sheet opens with the keyboard up and "Food" in the header. Type `250`, tap Save. The donut gets a slice, Food shows `₹250` and `100%`, the balance becomes `-₹250` in red, and the entry appears under Recent entries.
2. Tap **Income**: type `50000`, source `Salary` (or tap a chip next time). Save. The balance becomes `₹49,750`.
3. Tap an entry: the sheet opens filled in. Change the amount, Save. Tap again and use Delete entry.
4. Long-press an entry: delete confirmation dialog.
5. Try saving with an empty amount: a red message appears and nothing is saved.
6. Pick a date from an earlier period (for example last month). The entry will not show on the dashboard, because it belongs to another period. You will see it in History in Step 5.

---

# STEP 4: Category management

## 4.1 `src/components/CategoryEditModal.js` (new)

```js
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { colors, spacing, radius, CATEGORY_COLORS } from '../constants/theme';
import { ICON_LIST } from '../constants/iconList';
import { confirmDelete } from '../utils/confirm';
import { addCategory, updateCategory, archiveOrDeleteCategory } from '../db/database';

// category = the category being edited, or null to create a new one
export default function CategoryEditModal({ visible, category, onClose, onSaved }) {
  const db = useSQLiteContext();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ICON_LIST[0]);
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  // Fill the form each time the sheet opens
  useEffect(() => {
    if (!visible) {
      return;
    }
    setError('');
    setSearch('');
    if (category) {
      setName(category.name);
      setIcon(category.icon);
      setColor(category.color);
    } else {
      setName('');
      setIcon('dots-horizontal-circle-outline');
      setColor(CATEGORY_COLORS[0]);
    }
  }, [visible, category]);

  // Icons whose name contains the search text
  const query = search.trim().toLowerCase();
  const filteredIcons = ICON_LIST.filter((n) => n.includes(query));

  async function handleSave() {
    const trimmed = name.trim();
    if (trimmed === '') {
      setError('Enter a category name');
      return;
    }
    if (category) {
      await updateCategory(db, category.id, { name: trimmed, icon, color });
    } else {
      await addCategory(db, { name: trimmed, icon, color });
    }
    onSaved();
  }

  function handleDelete() {
    confirmDelete(
      'Delete category',
      'If this category has entries, it will be hidden but old history keeps it. If it has no entries, it is removed.',
      async () => {
        const result = await archiveOrDeleteCategory(db, category.id);
        console.log('Category delete result:', result);
        onSaved();
      }
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior="padding">
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{category ? 'Edit category' : 'New category'}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityLabel="Close">
              <MaterialCommunityIcons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Preview + name */}
            <View style={styles.previewRow}>
              <View style={[styles.previewCircle, { backgroundColor: color + '1F' }]}>
                <MaterialCommunityIcons name={icon} size={28} color={color} />
              </View>
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="Category name"
                placeholderTextColor={colors.textMuted}
                maxLength={20}
              />
            </View>
            {error !== '' && <Text style={styles.error}>{error}</Text>}

            {/* Color picker */}
            <Text style={styles.label}>Color</Text>
            <View style={styles.wrap}>
              {CATEGORY_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c }]}
                  onPress={() => setColor(c)}
                  accessibilityLabel={`Color ${c}`}
                >
                  {c === color && <MaterialCommunityIcons name="check" size={22} color="#FFFFFF" />}
                </TouchableOpacity>
              ))}
            </View>

            {/* Icon picker */}
            <Text style={styles.label}>Icon</Text>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search icons (food, car, home...)"
              placeholderTextColor={colors.textMuted}
            />
            <View style={styles.wrap}>
              {filteredIcons.map((iconName) => {
                const selected = iconName === icon;
                return (
                  <TouchableOpacity
                    key={iconName}
                    style={[styles.iconCell, selected && styles.iconCellSelected]}
                    onPress={() => setIcon(iconName)}
                    accessibilityLabel={iconName}
                  >
                    <MaterialCommunityIcons
                      name={iconName}
                      size={24}
                      color={selected ? '#FFFFFF' : colors.text}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
            {filteredIcons.length === 0 && <Text style={styles.empty}>No icons found</Text>}
          </ScrollView>

          {/* Fixed footer so Save is always visible */}
          <View style={styles.footer}>
            {category && (
              <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} accessibilityLabel="Delete category">
                <MaterialCommunityIcons name="trash-can-outline" size={22} color={colors.expense} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  backdrop: { flex: 1 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.xl,
    paddingRight: spacing.sm,
    paddingTop: spacing.sm,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  closeButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },

  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  previewCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  nameInput: {
    flex: 1,
    backgroundColor: colors.chip,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    fontSize: 16,
    color: colors.text,
  },
  error: { color: colors.expense, fontSize: 13, marginTop: spacing.sm },
  label: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  colorDot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  searchInput: {
    backgroundColor: colors.chip,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.md,
  },
  iconCell: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCellSelected: { backgroundColor: colors.accent },
  empty: { fontSize: 14, color: colors.textMuted, marginTop: spacing.sm },

  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  deleteButton: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
```

**How it works.**
- **One form for add and edit.** `category` is `null` for a new category and an object for an existing one. The reset effect fills the fields accordingly.
- **Live preview.** The circle at the top uses the currently selected `icon` and `color`, so you see the result before saving.
- **Icon search.** `ICON_LIST.filter(n => n.includes(query))`. Typing "car" shows `car`, `car-wrench`, `bus`... only those whose name contains "car". An empty search matches everything (every string includes `''`).
- **Color picker.** 16 dots. The selected one shows a check mark.
- **Fixed footer.** The Save and Delete buttons are outside the `ScrollView`, so they never scroll out of view.
- **Delete.** `archiveOrDeleteCategory` decides whether to archive (has entries) or remove permanently. Past entries are never lost.

## 4.2 `src/screens/ManageCategoriesScreen.js` (replace the placeholder)

```js
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CategoryEditModal from '../components/CategoryEditModal';
import { colors, spacing, radius } from '../constants/theme';
import { getCategories, reorderCategories } from '../db/database';

export default function ManageCategoriesScreen() {
  const db = useSQLiteContext();
  const [categories, setCategories] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  const load = useCallback(async () => {
    const rows = await getCategories(db);
    console.log('Categories loaded for management:', rows.length);
    setCategories(rows);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function openNew() {
    setEditingCategory(null);
    setModalVisible(true);
  }

  function openEdit(category) {
    setEditingCategory(category);
    setModalVisible(true);
  }

  function handleSaved() {
    setModalVisible(false);
    load();
  }

  // direction: -1 moves up, +1 moves down
  async function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= categories.length) {
      return;
    }
    const list = [...categories];
    const [item] = list.splice(index, 1);
    list.splice(target, 0, item);
    setCategories(list); // update the screen immediately
    await reorderCategories(
      db,
      list.map((c) => c.id)
    );
  }

  function renderItem({ item, index }) {
    return (
      <View style={styles.row}>
        <TouchableOpacity style={styles.rowMain} onPress={() => openEdit(item)} activeOpacity={0.7}>
          <View style={[styles.iconCircle, { backgroundColor: item.color + '1F' }]}>
            <MaterialCommunityIcons name={item.icon} size={22} color={item.color} />
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.arrow}
          onPress={() => move(index, -1)}
          disabled={index === 0}
          accessibilityLabel={`Move ${item.name} up`}
        >
          <MaterialCommunityIcons
            name="chevron-up"
            size={26}
            color={index === 0 ? colors.border : colors.text}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.arrow}
          onPress={() => move(index, 1)}
          disabled={index === categories.length - 1}
          accessibilityLabel={`Move ${item.name} down`}
        >
          <MaterialCommunityIcons
            name="chevron-down"
            size={26}
            color={index === categories.length - 1 ? colors.border : colors.text}
          />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={categories}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListHeaderComponent={<Text style={styles.hint}>Tap a category to edit it. Use the arrows to change the order.</Text>}
        ListEmptyComponent={<Text style={styles.hint}>No categories yet. Add one below.</Text>}
      />

      <TouchableOpacity style={styles.addButton} onPress={openNew} activeOpacity={0.8}>
        <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
        <Text style={styles.addText}>Add category</Text>
      </TouchableOpacity>

      <CategoryEditModal
        visible={modalVisible}
        category={editingCategory}
        onClose={() => setModalVisible(false)}
        onSaved={handleSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, paddingBottom: 96 },
  hint: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingLeft: spacing.md,
    minHeight: 60,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 60 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontSize: 16, color: colors.text, marginLeft: spacing.md },
  arrow: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  addButton: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
  },
  addText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
```

**How it works.**
- `move`: copies the list, removes the item from its old position with `splice`, inserts it at the new position, updates the screen first (so it feels instant), then saves the new order with `reorderCategories`.
- The first item's up arrow and the last item's down arrow are disabled and greyed.
- The "Add category" button floats at the bottom (`position: 'absolute'`), and the list has extra bottom padding (96) so the last row is never hidden behind it.
- The order you set here is the order of the dashboard grid and the quick-add chooser, because they all read `sort_order`.

## 4.3 `src/screens/SettingsScreen.js` (replace the placeholder)

We build Settings now so you can reach category management. It also contains the **change start day** feature.

```js
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DayPicker from '../components/DayPicker';
import { useAppContext } from '../context/AppContext';
import { setSetting } from '../db/database';
import { getPeriodForDate } from '../utils/period';
import { colors, spacing, radius } from '../constants/theme';

export default function SettingsScreen({ navigation }) {
  const db = useSQLiteContext();
  const { startDay, setStartDay } = useAppContext();

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState(startDay);

  function openDayModal() {
    setSelectedDay(startDay);
    setModalVisible(true);
  }

  async function handleSaveDay() {
    console.log('Changing period start day to:', selectedDay);
    await setSetting(db, 'period_start_day', selectedDay);
    // Updating the shared value makes every screen recalculate its period
    setStartDay(selectedDay);
    setModalVisible(false);
  }

  // Shows what the current period would be with the picked day
  const preview = getPeriodForDate(selectedDay);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Period start day */}
        <TouchableOpacity style={styles.row} onPress={openDayModal} activeOpacity={0.7}>
          <MaterialCommunityIcons name="calendar-refresh-outline" size={24} color={colors.text} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Period start day</Text>
            <Text style={styles.rowSub}>Day {startDay} of each month</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Manage categories */}
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigation.navigate('ManageCategories')}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="shape-outline" size={24} color={colors.text} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Manage categories</Text>
            <Text style={styles.rowSub}>Add, edit, reorder or delete</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>Expense Tracker. All data stays on this phone.</Text>

      {/* Start day sheet */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={() => setModalVisible(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Period start day</Text>
            <DayPicker selectedDay={selectedDay} onSelect={setSelectedDay} />

            <Text style={styles.preview}>Current period would be {preview.fullLabel}.</Text>

            <View style={styles.warning}>
              <MaterialCommunityIcons name="information-outline" size={20} color={colors.textMuted} />
              <Text style={styles.warningText}>
                Your entries are not changed, but History will regroup them using the new start day, so
                past period totals and savings will change.
              </Text>
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleSaveDay} activeOpacity={0.8}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 64, gap: spacing.md },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  footer: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },

  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  backdrop: { flex: 1 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  preview: { fontSize: 14, color: colors.text, marginTop: spacing.lg },
  warning: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.chip,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  warningText: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
```

**How it works.**
- `startDay` and `setStartDay` come from `AppContext`. When you save, we write the new day to the database **and** call `setStartDay`. The Dashboard has `startDay` in its `useCallback` dependency list, so it reloads with the new period automatically.
- No entries are modified. Periods are calculated from dates every time (see `getAllPeriods`), so "recalculating history" simply happens. The warning tells you that totals per period will shift.
- `navigation.navigate('ManageCategories')` opens the screen we registered in `SettingsNavigator`.

**Checkpoint (Step 4).**
1. Settings tab shows two rows. Tap **Manage categories**.
2. Tap **Add category**: type "Pets", pick a paw icon (search "paw") and a color, Save. It appears at the bottom of the list.
3. Use the up arrow until it is first. Go to the Dashboard: Pets is the first icon.
4. Tap a category in the list to edit its name, icon or color.
5. Add an expense to Pets, then delete Pets in Manage categories. It disappears from the grid, but the entry still shows with its name and icon in Recent entries (the category was archived, not erased). Deleting a category that has no entries removes it fully.

---

# STEP 5: History and period detail

## 5.1 `src/components/SummaryRow.js` (new)

```js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../constants/theme';
import { formatINR } from '../utils/money';

// Small helper: one labelled number
function Column({ label, value, color }) {
  return (
    <View style={styles.column}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

// Income / Expense / Savings in one row.
// For the current period the third column is called "Remaining" because it is not final yet.
export default function SummaryRow({ income, expense, savings, isCurrent }) {
  return (
    <View style={styles.row}>
      <Column label="Income" value={formatINR(income)} color={colors.income} />
      <Column label="Expense" value={formatINR(expense)} color={colors.expense} />
      <Column
        label={isCurrent ? 'Remaining' : 'Savings'}
        value={formatINR(savings)}
        color={savings < 0 ? colors.expense : colors.text}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  column: { flex: 1 },
  label: { fontSize: 12, color: colors.textMuted },
  value: { fontSize: 16, fontWeight: '700', marginTop: 2 },
});
```

**How it works.** Three equal columns (`flex: 1`). `Column` is a small component defined in the same file because only this file uses it. The third label switches between "Savings" (finished period) and "Remaining" (current period, still changing).

## 5.2 `src/screens/HistoryScreen.js` (replace the placeholder)

```js
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import SummaryRow from '../components/SummaryRow';
import { useAppContext } from '../context/AppContext';
import { colors, spacing, radius } from '../constants/theme';
import { getAllPeriods } from '../db/database';

export default function HistoryScreen({ navigation }) {
  const db = useSQLiteContext();
  const { startDay } = useAppContext();
  const [periods, setPeriods] = useState([]);

  const load = useCallback(async () => {
    const list = await getAllPeriods(db, startDay);
    console.log('Periods loaded:', list.length);
    setPeriods(list);
  }, [db, startDay]);

  // Reload whenever the tab is shown (entries may have changed)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function renderItem({ item }) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('PeriodDetail', { period: item })}
        activeOpacity={0.8}
      >
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle}>{item.fullLabel}</Text>
          {item.isCurrent && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Current</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
        </View>
        <SummaryRow
          income={item.income}
          expense={item.expense}
          savings={item.savings}
          isCurrent={item.isCurrent}
        />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={periods}
        keyExtractor={(item) => item.start}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={<Text style={styles.empty}>No periods yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md, minHeight: 32 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  badge: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  empty: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
});
```

**How it works.**
- `getAllPeriods` returns every period newest first, always including the current one, even if it has no entries yet. That is the "empty state when a new period starts" you asked for: on the 15th, a new current period appears with zeros, and the finished one sits below it with its **savings** (income minus expense).
- Tapping a card sends the whole `item` (start, end, labels, totals, `isCurrent`) to `PeriodDetail` as a route param.
- `keyExtractor` uses `item.start` because each period has a unique start date.

## 5.3 `src/screens/PeriodDetailScreen.js` (replace the placeholder)

```js
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DonutChart from '../components/DonutChart';
import SummaryRow from '../components/SummaryRow';
import TransactionRow from '../components/TransactionRow';
import AddTransactionModal from '../components/AddTransactionModal';
import { colors, spacing, radius } from '../constants/theme';
import { formatINR, percentOf } from '../utils/money';
import { confirmDelete } from '../utils/confirm';
import {
  getPeriodTotals,
  getCategoryTotals,
  getTransactionsForPeriod,
  getCategories,
  getIncomeSources,
  deleteTransaction,
} from '../db/database';

export default function PeriodDetailScreen({ route, navigation }) {
  const { period } = route.params;
  const db = useSQLiteContext();

  const [totals, setTotals] = useState({ income: 0, expense: 0 });
  const [categoryTotals, setCategoryTotals] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [incomeSources, setIncomeSources] = useState([]);
  const [editing, setEditing] = useState(null);

  // Show the period in the header, for example "15 Sep - 14 Oct"
  useEffect(() => {
    navigation.setOptions({ title: period.label });
  }, [navigation, period.label]);

  const load = useCallback(async () => {
    const t = await getPeriodTotals(db, period.start, period.end);
    const c = await getCategoryTotals(db, period.start, period.end);
    const tx = await getTransactionsForPeriod(db, period.start, period.end);
    const cats = await getCategories(db);
    const s = await getIncomeSources(db);
    setTotals(t);
    setCategoryTotals(c);
    setTransactions(tx);
    setCategories(cats);
    setIncomeSources(s);
  }, [db, period.start, period.end]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Only categories that have spending in this period
  const spentCategories = categoryTotals.filter((c) => c.total > 0);
  const donutData = spentCategories.map((c) => ({ id: c.id, value: c.total, color: c.color }));
  const incomeEntries = transactions.filter((t) => t.type === 'income');
  const expenseEntries = transactions.filter((t) => t.type === 'expense');

  function handleLongPressDelete(item) {
    confirmDelete('Delete entry', `Delete ${formatINR(item.amount)}? This cannot be undone.`, async () => {
      await deleteTransaction(db, item.id);
      load();
    });
  }

  function handleSaved() {
    setEditing(null);
    load();
  }

  // Draws a list of entries inside a white card
  function renderEntries(list, emptyText) {
    if (list.length === 0) {
      return (
        <View style={styles.card}>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      );
    }
    return (
      <View style={styles.card}>
        {list.map((item, index) => (
          <TransactionRow
            key={item.id}
            item={item}
            isLast={index === list.length - 1}
            onPress={() => setEditing(item)}
            onLongPress={() => handleLongPressDelete(item)}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.fullLabel}>{period.fullLabel}</Text>

        {/* Summary */}
        <View style={styles.card}>
          <SummaryRow
            income={totals.income}
            expense={totals.expense}
            savings={totals.income - totals.expense}
            isCurrent={period.isCurrent}
          />
        </View>

        {/* Donut */}
        <View style={[styles.card, styles.donutCard]}>
          <DonutChart data={donutData} size={200} strokeWidth={24}>
            <Text style={styles.donutLabel}>Spent</Text>
            <Text style={styles.donutAmount} numberOfLines={1} adjustsFontSizeToFit>
              {formatINR(totals.expense)}
            </Text>
          </DonutChart>
        </View>

        {/* Category-wise totals */}
        <Text style={styles.sectionTitle}>By category</Text>
        <View style={styles.card}>
          {spentCategories.length === 0 ? (
            <Text style={styles.emptyText}>No expenses in this period.</Text>
          ) : (
            spentCategories.map((c, index) => (
              <View
                key={c.id}
                style={[styles.catRow, index !== spentCategories.length - 1 && styles.catDivider]}
              >
                <View style={[styles.catIcon, { backgroundColor: c.color + '1F' }]}>
                  <MaterialCommunityIcons name={c.icon} size={20} color={c.color} />
                </View>
                <Text style={styles.catName} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text style={styles.catPercent}>{percentOf(c.total, totals.expense)}%</Text>
                <Text style={styles.catTotal}>{formatINR(c.total)}</Text>
              </View>
            ))
          )}
        </View>

        {/* Income entries */}
        <Text style={styles.sectionTitle}>Income ({incomeEntries.length})</Text>
        {renderEntries(incomeEntries, 'No income in this period.')}

        {/* Expense entries */}
        <Text style={styles.sectionTitle}>Expenses ({expenseEntries.length})</Text>
        {renderEntries(expenseEntries, 'No expenses in this period.')}

        <Text style={styles.hint}>Tap an entry to edit it. Long press to delete.</Text>
      </ScrollView>

      {/* Edit sheet (visible only while an entry is selected) */}
      <AddTransactionModal
        visible={editing !== null}
        type={editing ? editing.type : 'expense'}
        categories={categories}
        incomeSources={incomeSources}
        presetCategoryId={null}
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={handleSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  fullLabel: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  donutCard: { alignItems: 'center', marginTop: spacing.md, paddingVertical: spacing.xl },
  donutLabel: { fontSize: 12, color: colors.textMuted },
  donutAmount: { fontSize: 20, fontWeight: '700', color: colors.text },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.xl, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md },
  catRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: spacing.md },
  catDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  catIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  catName: { flex: 1, fontSize: 15, color: colors.text },
  catPercent: { fontSize: 13, color: colors.textMuted },
  catTotal: { fontSize: 15, fontWeight: '600', color: colors.text, minWidth: 80, textAlign: 'right' },
  hint: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
});
```

**How it works.**
- `route.params.period` carries the period from History (or from the Dashboard's "View all"). The screen then asks the database for exactly that date range, so it works for any past or current period.
- `getCategoryTotals` already includes archived categories that have spending in the range, so old periods keep showing deleted categories correctly.
- **Edit and delete**: tapping a row sets `editing`, which opens the same `AddTransactionModal` in edit mode (`visible={editing !== null}`). Saving or deleting calls `handleSaved`, which clears `editing` and reloads. Long press deletes with a confirmation.
- Totals, percentages and savings are all computed from the database every time, so edits here are reflected in History immediately when you go back (History reloads on focus).

**Checkpoint (Step 5).**
1. Open the History tab: you see the current period marked **Current** with Income, Expense and Remaining.
2. Add an entry with a date from the previous period (use the date picker on the Dashboard sheet, for example 20 days ago). History now shows two periods. The older one shows **Savings**.
3. Tap a period: summary, donut, category list with percentages, income entries and expense entries. Tap an entry, change it, save. The numbers update.
4. From the Dashboard, add more than 8 entries: "View all" appears and opens the current period's detail with a back button.

---

# STEP 6: Polish, final setup, full test

## 6.1 `app.json` (edit one value)

Open `app.json`. Inside `"expo": { ... }` set the app name and force the light look (the app has no dark theme):

```json
{
  "expo": {
    "name": "Expense Tracker",
    "userInterfaceStyle": "light"
  }
}
```

Keep every other existing key. Only change or add these two. The name appears under the app icon when you build an installable APK later. (Expo Go always shows its own splash screen.)

## 6.2 Edge cases the code already handles

| Case | How it is handled |
|---|---|
| Period crosses a year (15 Dec to 14 Jan) | `new Date(year, month + 1, startDay - 1)` rolls over to the next year automatically. Labels show the year in History. |
| Start day 1 | End date is `new Date(y, m + 1, 0)`, the last day of the month. |
| Negative balance | Remaining balance and savings turn red and show `-₹1,500`. |
| Very large amounts | Input limited to 13 characters and ₹9,99,99,999.99 maximum, with an error message above that. `adjustsFontSizeToFit` shrinks big numbers. |
| Typing `1.234` or `abc` | Rejected by `rupeesToPaise`. Letters cannot be typed at all. |
| Deleting a category with entries | Archived, never erased. History still shows its name, icon and color. |
| Editing an entry whose category is archived | The category is kept in the chooser, so the entry stays valid. |
| Changing the start day | Entries are untouched. History regroups them. |
| Android back button | Closes any open sheet first (`onRequestClose`), otherwise goes back one screen. |
| Keyboard covering fields | `KeyboardAvoidingView` plus a scrollable sheet. |
| Empty states | Dashboard, History detail and category lists all show a helpful message. |

## 6.3 Full test checklist

Run through this once. It covers every feature you asked for.

1. **First launch**: setup screen, pick 15, Continue. Period label matches today's date.
2. **Income**: Income button, amount `50000`, source `Salary`, today. Balance shows ₹50,000. Add a second income `2000` with source `Freelance`. Open the Income sheet again: both sources appear as chips.
3. **Quick add**: tap Food, `250`, Save. Tap Fuel, `1200`, set date to Yesterday, Save. Donut shows two slices. Grid shows totals and percentages.
4. **Expense button**: choose a category inside the sheet. Try saving with no category: error appears.
5. **Edit and delete**: tap an entry, change it, save. Long press another entry and delete it.
6. **Categories**: Settings > Manage categories. Add, edit, reorder, delete. Check the dashboard grid order.
7. **History**: add an entry dated in the previous period. History shows both periods. Previous period shows Savings. Open it and check the category percentages.
8. **Period rollover test without waiting**: Settings > Period start day, pick a day later than today (for example if today is the 31st and the start day is 15, pick 28). The current period changes and the dashboard may become empty, because entries now fall in a different period. Switch back to 15 to restore.
9. **Year boundary test**: add an entry dated 20 Dec of last year with start day 15. History shows `15 Dec 20XX - 14 Jan 20XX`.
10. **Close and reopen the app**: all data is still there (stored in SQLite).

## 6.4 Troubleshooting

| Problem | Fix |
|---|---|
| `Unable to resolve "<package>"` | Run the install command from section 1.1, then `npx expo start -c`. |
| Red screen mentioning `useSQLiteContext` | A component using the database is outside `SQLiteProvider`. Check `App.js` matches section 2.7. |
| An icon shows as `?` | That icon name does not exist in your icon set. Replace it in `iconList.js` or `defaultCategories.js`. |
| Date picker does not open | Make sure `@react-native-community/datetimepicker` was installed with `npx expo install`, then restart with `-c`. |
| Keyboard hides the Save button | Scroll the sheet. It is scrollable. If it still overlaps, tell me your phone model. |
| Want to start from a clean database | Change `databaseName="expense.db"` in `App.js` to a new name such as `"expense2.db"`, or clear Expo Go storage in Android settings. |
| Old categories show but new column errors | Restart the app once. The migration in `initDatabase` adds `is_archived` on launch. |
| Changes not showing | Shake the phone > Reload, or restart with `npx expo start -c`. |

## 6.5 Final file checklist

Confirm every file exists and has the **final** content. Files marked "replaced" were placeholders or older versions.

| File | Written in | Status |
|---|---|---|
| `App.js` | 2.7 | replaced |
| `src/constants/theme.js` | 1.2 | new |
| `src/constants/defaultCategories.js` | 1.3 | unchanged |
| `src/constants/iconList.js` | 1.4 | new |
| `src/context/AppContext.js` | 1.5 | new |
| `src/utils/confirm.js` | 1.6 | new |
| `src/utils/money.js` | 1.7 | new |
| `src/utils/period.js` | 1.8 | new |
| `src/db/database.js` | 1.9 | replaced |
| `src/components/DonutChart.js` | 2.1 | new |
| `src/components/DayPicker.js` | 2.2 | new |
| `src/screens/SetupScreen.js` | 2.3 | new |
| `src/screens/DashboardScreen.js` | 3.3 | replaced (2.4 was the Step 2 version) |
| `src/navigation/AppNavigator.js` | 2.6 | new |
| `src/components/TransactionRow.js` | 3.1 | new |
| `src/components/AddTransactionModal.js` | 3.2 | new |
| `src/components/CategoryEditModal.js` | 4.1 | new |
| `src/screens/ManageCategoriesScreen.js` | 4.2 | replaced placeholder |
| `src/screens/SettingsScreen.js` | 4.3 | replaced placeholder |
| `src/components/SummaryRow.js` | 5.1 | new |
| `src/screens/HistoryScreen.js` | 5.2 | replaced placeholder |
| `src/screens/PeriodDetailScreen.js` | 5.3 | replaced placeholder |
| `app.json` | 6.1 | name and light mode |

---

## Appendix: how the data flows (one picture in words)

1. You tap **Food** on the Dashboard. `openCategory` sets the `modal` state.
2. `AddTransactionModal` appears with Food preselected. You type 250 and tap Save.
3. `handleSave` validates, converts `250` to `25000` paise, and calls `addTransaction`, which runs `INSERT INTO transactions ...`.
4. The modal calls `onSaved`. The Dashboard closes the sheet and calls `load()`.
5. `load()` runs the totals queries again, `setState` stores the results, and React redraws: the donut slice, the grid total, the percentage, the balance and the recent list all update together.
6. Later, History runs `getAllPeriods`, which groups all entries into periods using your start day. A finished period's income minus expense is its savings.

Nothing is cached between screens. Every screen reloads from SQLite when it becomes visible, so the database is always the single source of truth and screens can never disagree with each other.
