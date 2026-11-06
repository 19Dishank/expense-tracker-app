// Central place for colors, spacing and corner radius.
// Spacing uses multiples of 4 so the layout stays consistent.

export const lightColors = {
  background: '#F7F8FA', // screen background (light grey)
  surface: '#FFFFFF', // cards, sheets
  border: '#E5E7EB', // thin lines
  accent: '#1C1C1E', // main dark color (buttons, selected items)
  accentText: '#FFFFFF',
  text: '#1C1C1E', // normal text
  textMuted: '#6B7280', // secondary text
  income: '#2E9E6B', // green
  expense: '#D9534F', // red
  warning: '#D9A93E', // amber, shown when most of the income is spent
  chip: '#F3F4F6', // light grey for chips and inputs
  overlay: 'rgba(0,0,0,0.4)', // dark layer behind bottom sheets
  onColor: '#FFFFFF', // text and icons placed on a green or red fill
};

export const darkColors = {
  background: '#0E0F12', // deep slate/black background
  surface: '#18191E', // elevated card/sheet surface
  border: '#262830', // subtle dark divider
  accent: '#E5E7EB', // buttons, selected chips and icons (light on dark, so they can be seen)
  accentText: '#0E0F12', // text on top of the accent color
  text: '#F9FAFB', // primary white/off-white text
  textMuted: '#9CA3AF', // secondary muted text
  income: '#34D399', // bright vibrant green
  expense: '#F87171', // bright coral red
  warning: '#FBBF24', // bright warm amber
  chip: '#22242C', // input & chip background
  overlay: 'rgba(0,0,0,0.7)', // backdrop
  onColor: '#0E0F12', // dark text and icons on the bright green and red fills
};

// Default export for backward compatibility
export const colors = lightColors;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 8, md: 12, lg: 16, xl: 24 };

// 16 muted colors for the category color picker
export const CATEGORY_COLORS = [
  '#E8825A', '#D9605F', '#C96B9A', '#9A6FC4',
  '#8A7BD1', '#5C7CBA', '#4F8FD6', '#3F7F9E',
  '#3FA7A0', '#5FAD7A', '#8FAE5A', '#D9A93E',
  '#C98A4B', '#A0785A', '#6E8BA3', '#8C8C8C',
];

export { useTheme, useThemedStyles } from '../context/ThemeContext';
