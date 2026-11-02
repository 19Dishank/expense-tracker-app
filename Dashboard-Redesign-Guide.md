# Dashboard Redesign: Ring Layout, Leader Lines, Smart Balance

This fixes the bugs in your screenshot, adds the "donut in the middle, categories around it, lines with percentages" layout, and adds the balance calculations. **All logic is written and tested here.** Antigravity only does the visual integration.

---

## 1. What was wrong in your screenshot

| Bug | Cause | Fix |
|---|---|---|
| "Spent ₹6,362" and "Income ₹25,000" sit **below** the donut and overlap the Groceries and Transport icons | `DonutChart.js` used `StyleSheet.absoluteFillObject`, which no longer exists in newer React Native. The center view lost its absolute position and dropped under the ring. | Explicit `position: 'absolute'` values (new `DonutChart.js` below). |
| Donut is on top, categories are a plain grid under it | Old layout | New `CategoryRing`: donut in the middle, categories on the outer cells around it. |
| No connection between a category and its slice | Not built | Leader line from each spent category to its own slice, percentage printed under the icon. |
| Transport shows `0%` for ₹12 | Plain rounding | Shows `<1%`. Percentages use the largest remainder method, so the shown numbers always add up to 100. |
| Uneven row gaps | Cells grew taller when they had totals | Every cell has a fixed height (92). |
| Remaining balance is just a number | Plain row | New balance card: status, progress bar, days left, safe daily spend, tap to expand. |

---

## 2. How the new dashboard works

- The screen is a grid of **4 columns**. Categories sit on the outer cells: top row, right column, bottom row, left column. The donut fills the middle 2 columns.
- **Category order is clockwise, starting at the top-left cell.** Reordering categories in Settings changes their positions.
- 14 categories fill the ring exactly. If you add more, the ring grows taller by adding middle rows (2 more icons per row). The screen scrolls.
- For every category with spending, a thin line runs from its slice on the donut to its icon. The line ends beside the icon, never across the name text.
- Under the icon you see the **percentage in bold** and the amount, for example `79%  ₹5,000`.
- Slices are ordered by where their icons sit, and the donut is **rotated automatically** to the angle where most icons face their own slice. Result: short, straight lines that do not cross.
- Deleted (archived) categories that still have spending keep a slice in the donut, with no icon and no line.

---

## 3. Step A: add one color to `src/constants/theme.js`

Inside the `colors` object add this line (used by the balance card for the "careful" state):

```js
  warning: '#D9A93E', // amber, shown when most of the income is spent
```

---

## 4. Step B: create or replace these 4 files

### 4.1 `src/utils/ringLayout.js` (new)

All geometry and percentage math. No React in it.

```js

// Pure math for the ring dashboard (no React in this file, so it is easy to test).
// All angles are in degrees, measured CLOCKWISE from the top (12 o'clock).
//
// The screen is split into a grid of 4 columns. Categories sit on the OUTER cells
// (top row, right column, bottom row, left column). The donut sits in the middle.
// Category order = clockwise, starting at the top-left cell.

export const COLUMNS = 4;
export const CELL_HEIGHT = 92;
export const ICON_SIZE = 48;
export const ICON_TOP = 6; // gap above the icon inside a cell
const ICON_CENTER_Y = ICON_TOP + ICON_SIZE / 2;
const TEXT_BOTTOM = 86; // y where the name + percent text ends inside a cell
const MIN_MIDDLE_ROWS = 3;
const ROTATION_STEP = 5; // degrees tried when looking for the best donut rotation

// Point on a circle. angleDeg is clockwise from the top.
export function polarToXY(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

// Angle (clockwise from top) of the point (x, y) as seen from the center (cx, cy)
export function angleFromCenter(cx, cy, x, y) {
  const deg = (Math.atan2(x - cx, -(y - cy)) * 180) / Math.PI;
  return (deg + 360) % 360;
}

// Smallest difference between two angles (0 to 180)
function angleDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// How far an angle is from an arc that starts at startAngle and spans sweep degrees.
// 0 means the angle is inside the arc.
function distanceToArc(startAngle, sweep, angle) {
  const delta = (((angle - startAngle) % 360) + 360) % 360;
  if (delta <= sweep) {
    return 0;
  }
  return Math.min(delta - sweep, 360 - delta);
}

// Angle inside the arc that is closest to the icon (kept a little away from the edges)
function pickLineAngle(startAngle, sweep, iconAngle) {
  const margin = Math.min(6, sweep / 2);
  const delta = (((iconAngle - startAngle) % 360) + 360) % 360;
  let local;
  if (delta <= sweep) {
    local = delta;
  } else {
    local = delta - sweep < 360 - delta ? sweep : 0;
  }
  local = Math.min(Math.max(local, margin), sweep - margin);
  return (startAngle + local) % 360;
}

// Percentages that always add up to exactly 100 (largest remainder method).
// items = [{ id, total }]  ->  { [id]: { exact, whole, label } }
// label is "<1%" for anything under one percent.
export function computePercents(items) {
  const sum = items.reduce((s, i) => s + i.total, 0);
  if (sum <= 0) {
    return {};
  }
  const rows = items.map((i) => {
    const exact = (i.total / sum) * 100;
    return { id: i.id, exact, whole: Math.floor(exact) };
  });
  const remainder = 100 - rows.reduce((s, r) => s + r.whole, 0);
  const byFraction = [...rows].sort((a, b) => b.exact - b.whole - (a.exact - a.whole));
  for (let i = 0; i < remainder && i < byFraction.length; i++) {
    byFraction[i].whole += 1;
  }
  const result = {};
  rows.forEach((r) => {
    result[r.id] = { exact: r.exact, whole: r.whole, label: r.exact < 1 ? '<1%' : r.whole + '%' };
  });
  return result;
}

// Clockwise list of the outer cells: top row, right column, bottom row, left column
function buildSlots(middleRows) {
  const slots = [];
  const lastRow = middleRows + 1;
  for (let col = 0; col < COLUMNS; col++) {
    slots.push({ col, row: 0, side: 'top' });
  }
  for (let row = 1; row <= middleRows; row++) {
    slots.push({ col: COLUMNS - 1, row, side: 'right' });
  }
  for (let col = COLUMNS - 1; col >= 0; col--) {
    slots.push({ col, row: lastRow, side: 'bottom' });
  }
  for (let row = middleRows; row >= 1; row--) {
    slots.push({ col: 0, row, side: 'left' });
  }
  return slots;
}

// Where the leader line ends. It stops next to the icon, never on top of the text.
function getAnchor(slot, cellW) {
  const xc = (slot.col + 0.5) * cellW;
  const top = slot.row * CELL_HEIGHT;
  if (slot.side === 'top') {
    return { x: xc, y: top + TEXT_BOTTOM }; // below the name and percent
  }
  if (slot.side === 'bottom') {
    return { x: xc, y: top + ICON_TOP - 2 }; // just above the icon
  }
  if (slot.side === 'left') {
    return { x: xc + ICON_SIZE / 2 + 3, y: top + ICON_CENTER_Y }; // right edge of the icon
  }
  return { x: xc - ICON_SIZE / 2 - 3, y: top + ICON_CENTER_Y }; // left edge of the icon
}

// Sizes and positions for the whole ring area.
// width = screen width, categoryCount = how many active categories exist.
// 14 categories fit exactly with 3 middle rows. More categories add middle rows.
export function buildRingLayout(width, categoryCount) {
  const middleRows = Math.max(MIN_MIDDLE_ROWS, Math.ceil((categoryCount - 2 * COLUMNS) / 2));
  const cellW = width / COLUMNS;
  const rows = middleRows + 2;
  const height = rows * CELL_HEIGHT;
  const donutSize = Math.min(2 * cellW - 4, middleRows * CELL_HEIGHT - 16);
  const strokeWidth = Math.round(donutSize * 0.12);
  return {
    width,
    height,
    cellW,
    cx: width / 2,
    cy: height / 2,
    donutSize,
    strokeWidth,
    outerRadius: donutSize / 2, // outer edge of the ring
    ringRadius: donutSize / 2 - strokeWidth / 2, // middle of the ring stroke
    slots: buildSlots(middleRows),
  };
}

// Gives every category its cell position and its line anchor point
export function placeCategories(layout, categories) {
  return categories.map((cat, i) => {
    const slot = layout.slots[i];
    return {
      ...cat,
      slot,
      left: slot.col * layout.cellW,
      top: slot.row * CELL_HEIGHT,
      anchor: getAnchor(slot, layout.cellW),
    };
  });
}

// Builds the donut slices and the leader lines.
// placed = result of placeCategories, archivedSpending = deleted categories that still have spending
// Returns { slices, rotation, percents }
export function buildSlices(layout, placed, archivedSpending = []) {
  // Spent categories ordered by where their icon sits around the donut,
  // so lines never cross each other.
  const linked = placed
    .filter((c) => c.total > 0)
    .map((c) => ({
      ...c,
      iconAngle: angleFromCenter(layout.cx, layout.cy, c.anchor.x, c.anchor.y),
    }))
    .sort((a, b) => a.iconAngle - b.iconAngle);

  // Archived categories have no icon on screen, so they get a slice but no line
  const archived = archivedSpending
    .filter((c) => c.total > 0)
    .map((c) => ({ ...c, iconAngle: null, anchor: null }));

  const items = [...linked, ...archived];
  const sum = items.reduce((s, c) => s + c.total, 0);
  if (items.length === 0 || sum <= 0) {
    return { slices: [], rotation: 0, percents: {} };
  }

  const percents = computePercents(items);
  const sweeps = items.map((c) => (c.total / sum) * 360);

  // Try rotating the whole donut and keep the rotation where most icons
  // sit right in front of their own slice (shortest, straightest lines).
  let bestRotation = 0;
  let bestCost = Infinity;
  for (let rot = 0; rot < 360; rot += ROTATION_STEP) {
    let cumulative = 0;
    let cost = 0;
    items.forEach((c, i) => {
      if (c.iconAngle !== null) {
        const start = rot + cumulative;
        cost += distanceToArc(start, sweeps[i], c.iconAngle);
        // tiny tie-breaker: prefer the slice middle facing the icon
        cost += 0.01 * angleDistance((start + sweeps[i] / 2) % 360, c.iconAngle);
      }
      cumulative += sweeps[i];
    });
    if (cost < bestCost) {
      bestCost = cost;
      bestRotation = rot;
    }
  }

  let cumulative = 0;
  const slices = items.map((c, i) => {
    const startAngle = bestRotation + cumulative;
    const slice = {
      id: c.id,
      color: c.color,
      total: c.total,
      fractionStart: cumulative / 360,
      fraction: sweeps[i] / 360,
      lineFrom: null,
      lineTo: null,
    };
    if (c.anchor) {
      const lineAngle = pickLineAngle(startAngle, sweeps[i], c.iconAngle);
      slice.lineFrom = polarToXY(layout.cx, layout.cy, layout.outerRadius + 3, lineAngle);
      slice.lineTo = c.anchor;
    }
    cumulative += sweeps[i];
    return slice;
  });

  return { slices, rotation: bestRotation, percents };
}

```

### 4.2 `src/utils/budget.js` (new)

All balance calculations for the card.

```js

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

  const avgDailySpend = Math.round(expense / elapsedDays);
  const projectedExpense = avgDailySpend * totalDays;
  // Safe amount per day for the rest of the period, rounded down to whole rupees
  const dailyAllowance =
    remaining > 0 && daysLeft > 0 ? Math.floor(remaining / daysLeft / 100) * 100 : 0;

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

  // Early in the period the projection is unreliable, so wait a few days
  const paceWarning =
    status !== 'over' && status !== 'empty' && elapsedDays >= 3 && daysLeft > 0 && projectedExpense > income;

  return {
    remaining,
    status,
    message,
    progress,
    percentSpent,
    totalDays,
    daysLeft,
    elapsedDays,
    avgDailySpend,
    projectedExpense,
    dailyAllowance,
    paceWarning,
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

```

### 4.3 `src/components/CategoryRing.js` (new)

```js

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Line } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../constants/theme';
import { formatINR } from '../utils/money';
import {
  CELL_HEIGHT,
  ICON_SIZE,
  ICON_TOP,
  buildRingLayout,
  placeCategories,
  buildSlices,
} from '../utils/ringLayout';

// Plain absolute positioning (do not use StyleSheet.absoluteFillObject, it is removed in newer React Native)
const ABSOLUTE = { position: 'absolute', top: 0, left: 0 };

// Donut in the middle, categories around it, and a line from every spent category to its slice.
//   categories       = active categories, each with { id, name, icon, color, total }
//   archivedSpending = deleted categories that still have spending (slice only, no icon)
//   onCategoryPress  = called with the category when its icon is tapped
//   children         = content shown inside the donut hole
export default function CategoryRing({ categories, archivedSpending = [], onCategoryPress, children }) {
  const { width } = useWindowDimensions();

  const layout = buildRingLayout(width, categories.length);
  const placed = placeCategories(layout, categories);
  const { slices, rotation, percents } = buildSlices(layout, placed, archivedSpending);

  const circumference = 2 * Math.PI * layout.ringRadius;
  const holeRadius = layout.ringRadius - layout.strokeWidth / 2;

  return (
    <View style={{ width: layout.width, height: layout.height }}>
      {/* Layer 1: lines, ring and slices (touches pass through to the icons) */}
      <Svg width={layout.width} height={layout.height} style={[ABSOLUTE, { pointerEvents: 'none' }]}>
        {/* Leader lines first, so the ring is drawn over them */}
        {slices.map(
          (s) =>
            s.lineFrom && (
              <Line
                key={'line-' + s.id}
                x1={s.lineFrom.x}
                y1={s.lineFrom.y}
                x2={s.lineTo.x}
                y2={s.lineTo.y}
                stroke={s.color}
                strokeWidth={1.5}
                strokeOpacity={0.6}
                strokeLinecap="round"
              />
            )
        )}

        {/* Fill the hole with the screen color so a line can never show through it */}
        <Circle cx={layout.cx} cy={layout.cy} r={holeRadius} fill={colors.background} />

        {/* Grey ring (also the empty state) */}
        <Circle
          cx={layout.cx}
          cy={layout.cy}
          r={layout.ringRadius}
          stroke="#E9ECEF"
          strokeWidth={layout.strokeWidth}
          fill="none"
        />

        {/* Colored slices */}
        <G rotation={rotation - 90} origin={`${layout.cx}, ${layout.cy}`}>
          {slices.map((s) => {
            const length = s.fraction * circumference;
            return (
              <Circle
                key={'slice-' + s.id}
                cx={layout.cx}
                cy={layout.cy}
                r={layout.ringRadius}
                stroke={s.color}
                strokeWidth={layout.strokeWidth}
                fill="none"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-s.fractionStart * circumference}
              />
            );
          })}
        </G>

        {/* Small dot where each line touches the ring */}
        {slices.map(
          (s) =>
            s.lineFrom && (
              <Circle key={'dot-' + s.id} cx={s.lineFrom.x} cy={s.lineFrom.y} r={3} fill={s.color} />
            )
        )}
      </Svg>

      {/* Layer 2: content inside the donut hole */}
      <View
        style={[
          ABSOLUTE,
          styles.hole,
          {
            left: layout.cx - layout.donutSize / 2,
            top: layout.cy - layout.donutSize / 2,
            width: layout.donutSize,
            height: layout.donutSize,
            paddingHorizontal: layout.strokeWidth + 8,
            pointerEvents: 'box-none',
          },
        ]}
      >
        {children}
      </View>

      {/* Layer 3: category icons around the donut */}
      {placed.map((cat) => {
        const spent = cat.total > 0;
        return (
          <TouchableOpacity
            key={cat.id}
            style={[ABSOLUTE, styles.cell, { left: cat.left, top: cat.top, width: layout.cellW, height: CELL_HEIGHT }]}
            onPress={() => onCategoryPress(cat)}
            activeOpacity={0.7}
            accessibilityLabel={`Add expense to ${cat.name}`}
          >
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: cat.color + '1F' },
                spent && { borderWidth: 1.5, borderColor: cat.color },
              ]}
            >
              <MaterialCommunityIcons name={cat.icon} size={26} color={cat.color} />
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {cat.name}
            </Text>
            {spent ? (
              <Text style={styles.stat} numberOfLines={1} adjustsFontSizeToFit>
                <Text style={styles.percent}>{percents[cat.id] ? percents[cat.id].label : ''}</Text>
                {'  ' + formatINR(cat.total)}
              </Text>
            ) : (
              <Text style={styles.stat}> </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  hole: { alignItems: 'center', justifyContent: 'center' },
  cell: { alignItems: 'center', paddingTop: ICON_TOP },
  iconCircle: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 12, color: colors.text, marginTop: 4, maxWidth: '92%' },
  stat: { fontSize: 11, color: colors.textMuted, marginTop: 1, maxWidth: '92%' },
  percent: { fontSize: 12, fontWeight: '700', color: colors.text },
});

```

### 4.4 `src/components/DonutChart.js` (replace the whole file)

Still used by the Period Detail screen. This is the bug fix.

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
  // FIX: StyleSheet.absoluteFillObject is missing in newer React Native versions,
  // which made this view fall BELOW the ring. Plain absolute values always work.
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
});

```

---

## 5. How the calculations work

**Layout (`buildRingLayout`).** Cell width is screen width divided by 4, cell height is 92. Middle rows = `max(3, ceil((categories - 8) / 2))`. Total outer slots = `8 + 2 × middleRows`, so 14 categories need 3 middle rows. Donut size = the smaller of two cell widths and the middle height, so it never touches the side icons.

**Percentages (`computePercents`).** Plain rounding can give 79 + 21 + 1 = 101. The largest remainder method rounds every value down, then gives the missing points to the entries with the biggest decimal parts. The shown percentages always add up to exactly 100. Anything under 1% shows `<1%`.

**Slices (`buildSlices`).**
1. Take every category that has spending.
2. Compute the angle of its icon around the donut center (0° = top, clockwise).
3. Sort by that angle. Sorting is what keeps lines from crossing.
4. Each slice sweep = `total ÷ all spending × 360°`.
5. Try 72 rotations (every 5°). For each, add up how far every icon is from its own slice. Keep the rotation with the smallest total. A distance of 0 means the icon is straight in front of its slice, so the line is radial.
6. The line starts at the point on the slice closest to the icon (kept 6° inside the edges) and ends at the anchor beside the icon.

**Balance card (`getBudgetSummary`).**

| Value | Formula |
|---|---|
| remaining | income − expense |
| progress | min(expense ÷ income, 1) |
| daysLeft | days from today to the period end, counting today |
| dailyAllowance | remaining ÷ daysLeft, rounded down to whole rupees (0 if nothing remains) |
| avgDailySpend | expense ÷ days passed so far (counting today) |
| projectedExpense | avgDailySpend × total days in the period |
| paceWarning | true when projectedExpense is above income, after at least 3 days, and you are not already over |
| status | `empty` (no income and no spending), `over` (remaining below 0), `warning` (80% or more of income spent), otherwise `good` |

Example from your screenshot (today 1 Nov, period 15 Oct to 14 Nov): income ₹25,000, spent ₹6,362, remaining ₹18,638, 25% spent, 14 days left, safe to spend ₹1,331 per day, status `good`.

---

## 6. Step C: change `DashboardScreen.js`

Antigravity does this for you (prompt below). If you want to do it by hand:

1. Remove `import DonutChart ...`. Add:
```js
import CategoryRing from '../components/CategoryRing';
import BalanceCard from '../components/BalanceCard';
```
2. Remove `donutData` and the old category grid JSX. Add next to `activeCategories`:
```js
  // Deleted categories that still have spending keep a slice in the donut
  const archivedSpending = categoryTotals.filter((c) => c.is_archived && c.total > 0);
```
3. Replace the donut block and the grid block with:
```jsx
<CategoryRing
  categories={activeCategories}
  archivedSpending={archivedSpending}
  onCategoryPress={openCategory}
>
  <Text style={styles.donutLabel}>Spent</Text>
  <Text style={styles.donutAmount} numberOfLines={1} adjustsFontSizeToFit>
    {formatINR(totals.expense)}
  </Text>
  <Text style={styles.donutIncome} numberOfLines={1} adjustsFontSizeToFit>
    Income {formatINR(totals.income)}
  </Text>
</CategoryRing>
```
Use `donutAmount` fontSize 22 so it fits inside the smaller hole.
4. In the bottom bar, replace the old "Remaining balance" row with:
```jsx
<BalanceCard income={totals.income} expense={totals.expense} periodStart={period.start} periodEnd={period.end} />
```
`BalanceCard` is built by Antigravity from the spec in the prompt.

---

## 7. Step D: the Antigravity prompt

Paste this after you have created the 4 files above.

````
You are continuing work on my personal Android expense tracker (Expo, React Native, PLAIN JAVASCRIPT, no TypeScript). I am a beginner, so keep code simple and readable.

TASK: Redesign the Dashboard screen. All the LOGIC is already written and tested. Your job is the visual integration and design polish. Do the steps in order. After each step, tell me which files you changed and what I should see on my phone.

========== FILES THAT ALREADY EXIST (read them first, do NOT change their logic) ==========
- src/utils/ringLayout.js     (geometry, slot positions, slice angles, percentages)
- src/utils/budget.js         (getBudgetSummary, statusColor, getPeriodDays)
- src/components/CategoryRing.js  (donut in the middle, categories around it, leader lines, percent under each icon)
- src/components/DonutChart.js    (bug already fixed)
You may change only colors, font sizes and spacing inside the styles of CategoryRing.js. Do NOT change its props, the geometry, or anything in ringLayout.js and budget.js. If you think a logic change is needed, tell me why instead of changing it.

========== STEP 0: THEME ==========
In src/constants/theme.js add to the colors object: warning: '#D9A93E'. Do not change any other color.

========== STEP 1: USE THE RING ON THE DASHBOARD ==========
Edit src/screens/DashboardScreen.js. First read the current file and keep everything that works: the header with the settings gear button, the recent entries list, AddTransactionModal wiring, load logic, and every console.log and comment. Do not remove any comment.

1. Remove the old DonutChart block and the old category grid (and their now unused styles and imports).
2. Add: const archivedSpending = categoryTotals.filter((c) => c.is_archived && c.total > 0);
3. Render this inside the ScrollView, in place of the old donut and grid:
   <CategoryRing categories={activeCategories} archivedSpending={archivedSpending} onCategoryPress={openCategory}>
     (center content: "Spent" label, formatINR(totals.expense) with numberOfLines={1} adjustsFontSizeToFit, and "Income " + formatINR(totals.income) in the income green)
   </CategoryRing>
   activeCategories is the categories list without archived ones, each with a numeric total.
4. The center text must stay INSIDE the donut hole. Sizes: label 12, amount 22 bold, income 11. The hole is about 130 to 160 dp wide, so never use a bigger amount font.
5. Do NOT use StyleSheet.absoluteFillObject anywhere in the project (it does not exist in this React Native version). Use position: 'absolute' with top, left, right, bottom values.

========== STEP 2: BALANCE CARD ==========
Create src/components/BalanceCard.js and use it in the dashboard bottom bar instead of the old "Remaining balance" row. Props: income, expense, periodStart, periodEnd (paise and 'YYYY-MM-DD' strings). Inside, call getBudgetSummary(income, expense, periodStart, periodEnd) from src/utils/budget.js and use statusColor(summary.status). Do NOT recalculate any of these numbers yourself.

Always visible (collapsed):
- Top row: label "Remaining balance" (13 sp, muted) on the left, a small status chip on the right showing summary.message (a 8 dp dot colored with statusColor plus the message in the normal text color, 12 sp), and a chevron icon that rotates when expanded.
- Big amount: formatINR(summary.remaining), 30 sp bold. Color is the normal text color, but colors.expense when summary.status is 'over'.
- Progress bar under the amount: 8 dp high, fully rounded, track color colors.chip, fill color statusColor(summary.status), width animated to summary.progress with Animated.timing (400 ms, useNativeDriver: false). Hide the bar when status is 'empty'.
- Under the bar, one row: left "<percentSpent>% of income spent", right "<daysLeft> days left" (use "1 day left" for one, and "Period ended" for zero). Both 12 sp, muted.

Expanded (tap anywhere on the card toggles it, animate with LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); skip any Android enabling call if it logs a warning):
- A thin divider, then a 2 by 2 grid:
  1. Income (green) = formatINR(income)
  2. Spent (red) = formatINR(expense)
  3. "Safe to spend per day" = formatINR(summary.dailyAllowance), with the small text "for the next N days" (N = summary.daysLeft)
  4. "Average spend per day" = formatINR(summary.avgDailySpend)
- When summary.paceWarning is true, show a note row with an information-outline icon: "At this pace you will spend <formatINR(summary.projectedExpense)> by the end of this period, which is more than your income."
- When status is 'empty', the card shows the message "Add your income to get started" and the amount stays formatINR(0).

Interaction and accessibility: the whole card is one Pressable, at least 48 dp high, with a subtle pressed state (background slightly darker, no ripple color gimmicks), accessibilityRole="button" and accessibilityState={{ expanded }}. The Expense and Income buttons stay below the card, unchanged.

========== STEP 3: DESIGN POLISH ==========
- Header: period label on the left, settings gear on the right, both vertically centered. Gear button is 48 by 48 dp, background colors.chip, icon colors.text, circular, NO shadow. Keep the existing navigation behavior.
- The ring area is full width with no horizontal padding (CategoryRing already uses the screen width). Put 8 dp of space above it and 16 dp below it.
- Recent entries section stays under the ring, same card style as now.
- Bottom bar: white surface, top corners radius 24, 16 dp padding, 12 dp between the card and the buttons. The bar must never overlap scrolling content: give the ScrollView enough bottom padding.
- Style rules: clean and minimal. White and light grey surfaces, one dark accent, green for income, red for expense, amber only for the warning state. NO gradients, NO neon, NO glassmorphism, NO emoji, NO decorative shadows (a single soft elevation on the bottom bar is allowed). It must not look AI-generated. Spacing in multiples of 4 or 8, consistent radius, clear text hierarchy. All touch targets at least 48 dp. All icons from MaterialCommunityIcons.

========== RULES ==========
- Plain JavaScript only. Functional components with hooks.
- Keep every existing console.log and every existing comment. Add short beginner-friendly comments to new code.
- Output complete files when you change them, not fragments.
- Do not touch the database, navigation, or other screens.

========== TEST BEFORE YOU SAY DONE ==========
Check each case on a 360 dp wide screen and a 411 dp wide screen. The app must bundle with no errors.
1. No expenses at all: grey ring, no lines, all icons visible, balance card says "Add your income to get started".
2. My real case: income 25,000, Food 5,000, Transport 12, Fuel 1,350. Expect: Spent 6,362, Food 79%, Fuel 21%, Transport "<1%", three lines from the donut to those icons, Remaining 18,638, "25% of income spent", status On track.
3. One category with 100% of the spending.
4. Spending above income: remaining shows negative in red, bar is full and red, chip says how much more was spent than income.
5. 80 percent or more of income spent: amber bar.
6. 17 categories: the ring grows taller, everything stays tappable, the screen scrolls.
7. Large amounts such as 12,34,56,789: text shrinks or truncates but never overlaps neighbors.
8. Tap each category icon: the add-expense sheet opens with that category preselected.
Then list the exact files created or changed.
````

---

## 8. After it is done: quick manual check

1. Dashboard opens with the donut centered and the "Spent" text inside the hole.
2. Add ₹2,500 to a category while income is ₹25,000 and spending is otherwise small: its slice grows, a line connects it to its icon, and the percentage under the icon updates.
3. Tap the balance card: it expands and shows safe spend per day.
4. Add a very large expense: the card turns red and says how much more you spent than your income.
5. Add a 15th category in Settings: the ring grows taller by one row and the new icon appears at the end of the clockwise order.
