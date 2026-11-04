# Fix: running balance must follow the order you added entries

## Problem

On the History tab, a new income (for example cashback) was placed **before** the expenses you had already added on the same date. That changed the balance of every expense below it.

Example: salary ₹50,000, then expenses, then cashback ₹5,000. The cashback jumped up next to the salary and made the balance ₹55,000 before the expenses.

## Cause

`src/utils/balance.js` sorted same-date entries with the rule "income first, then expense". That is wrong for a timeline.

## Fix

Order entries by **date**, then by **the order you added them** (`id`). A newly added entry now always lands after the entries you already had on that date.

Only one file changes. No database change, no new package.

## Step 1: replace the whole file `src/utils/balance.js`

```js
// Running balance for a list of entries. All money is in paise.
// The balance starts at 0 for every period (nothing carries over from the previous period).

// Timeline order: oldest date first. On the same date, the order you ADDED the entries in
// (id) is kept, so a later income never jumps in front of earlier expenses.
function compareEntries(a, b) {
  if (a.date !== b.date) {
    return a.date < b.date ? -1 : 1;
  }
  return a.id - b.id;
}

// Returns a NEW list in that order. Every entry gets a "balance" field:
// the money left right after that entry.
export function addRunningBalance(transactions, startingBalance = 0) {
  const sorted = [...transactions].sort(compareEntries);
  let balance = startingBalance;
  return sorted.map((t) => {
    balance += t.type === 'income' ? t.amount : -t.amount;
    return { ...t, balance };
  });
}
```

## Step 2: run

```bash
npx expo start -c
```

## Rules after this fix

| Situation | What happens |
|---|---|
| Entries on different dates | Oldest date first |
| Entries on the same date | In the order you added them |
| A new income or expense dated today | Goes to the end of today's entries |
| Entry dated earlier than your salary | Goes above the salary, and its balance can show negative. That is where it falls in time. |
| You edit an entry's amount, note or category | It keeps its position |
| You edit an entry's date | It moves to its new date |
| You delete an entry | Every balance after it is recalculated |
| Last balance in the list | Always equals the period's Savings (or Remaining) in the summary card |

This replaces the old rule "income comes before expense on the same date". Ignore that line in `README-history-balance.md`.

## Test it

1. Settings, **Clear all entries** (testing helper).
2. Add income `50000` (Salary), expense `3000` (Food), expense `2000` (Fuel), then income `5000` (Cashback). All with today's date.
3. History tab, tap **Current**. Under **Entries** you should see, in this order:
   - `+₹50,000` with `Bal ₹50,000`
   - `-₹3,000` with `Bal ₹47,000`
   - `-₹2,000` with `Bal ₹45,000`
   - `+₹5,000` with `Bal ₹50,000`
4. The summary card at the top shows Remaining `₹50,000`, the same as the last balance.
5. Add one more expense `1000`. It appears at the bottom with `Bal ₹49,000`, and the rows above do not change.
6. Tap the `-₹3,000` row and change the amount to `1000`. Its position does not move. Balances become `₹50,000`, `₹49,000`, `₹47,000`, `₹52,000`, `₹51,000`.
7. Add an expense dated yesterday. It appears at the top with a negative balance, and every row below it updates.

## Checked

I tested this exact case and 20,000 random periods (many same-date entries, backdated entries, large amounts). Every balance equals the previous balance plus or minus that row's own amount, the order is always date then entry order, and the last balance always equals total income minus total expense. I have not run it on a phone.
