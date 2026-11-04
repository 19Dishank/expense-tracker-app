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
