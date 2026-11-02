// Pure math for the ring dashboard (no React in this file, so it is easy to test).
// All angles are in degrees, measured CLOCKWISE from the top (12 o'clock).
//
// The screen is split into a grid of 4 columns. Categories sit on the OUTER cells
// (top row, right column, bottom row, left column). The donut sits in the middle.
// Categories are spread evenly around the donut (see buildFillOrder).

export const COLUMNS = 4;
export const CELL_HEIGHT = 96;
export const ICON_SIZE = 50;
export const ICON_TOP = 6; // gap above the icon inside a cell
const ICON_CENTER_Y = ICON_TOP + ICON_SIZE / 2;
const TEXT_BOTTOM = 88; // y where the name + percent text ends inside a cell
const MIN_MIDDLE_ROWS = 3; // 3 middle rows = prominent, hero-sized donut section
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
// Up to 14 categories fit with 3 middle rows. More categories add more middle rows.
export function buildRingLayout(width, categoryCount) {
  const middleRows = Math.max(MIN_MIDDLE_ROWS, Math.ceil((categoryCount - 2 * COLUMNS) / 2));
  const cellW = width / COLUMNS;
  const rows = middleRows + 2;
  const height = rows * CELL_HEIGHT;
  // Make the donut prominently fill the middle area without clipping the outer icon borders
  const donutSize = Math.min(2.25 * cellW, middleRows * CELL_HEIGHT - 32);
  const strokeWidth = Math.round(donutSize * 0.125);
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

// Order in which the outer cells are filled. Categories are placed consecutively in
// clockwise order starting from the top-left cell, with no empty spaces between them.
export function buildFillOrder(slots) {
  return slots.map((_, i) => i);
}

// Gives every category its cell position and its line anchor point.
// Fills slots consecutively in clockwise order starting from the top-left cell,
// with no empty spaces between them.
export function placeCategories(layout, categories) {
  return categories.map((cat, i) => {
    const slot = layout.slots[i % layout.slots.length];
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

