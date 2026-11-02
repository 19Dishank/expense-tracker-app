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
  warning: '#D9A93E', // amber, shown when most of the income is spent
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

