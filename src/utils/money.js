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

