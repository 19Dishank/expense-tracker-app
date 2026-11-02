// Default expense categories. Icon names come from MaterialCommunityIcons.
// Users can edit, delete and add more later (step 4).

// DEFAULT_CATEGORIES are seeded into the database the very first time the app runs.
// Keep this list short (6 items) so new users aren't overwhelmed.
export const DEFAULT_CATEGORIES = [
  { name: 'Food',          icon: 'silverware-fork-knife',          color: '#E8825A' },
  { name: 'Fuel',          icon: 'gas-station-outline',            color: '#8A7BD1' },
  { name: 'Home',          icon: 'home-outline',                   color: '#3F7F9E' },
  { name: 'Entertainment', icon: 'movie-open-outline',             color: '#9A6FC4' },
  { name: 'Mobile',        icon: 'phone-outline',                  color: '#6E8BA3' },
  { name: 'Investment',    icon: 'chart-line',                     color: '#5FAD7A' },
];

// SUGGESTED_CATEGORIES are shown in ManageCategoriesScreen as quick-add options.
// They are NOT seeded automatically — the user picks the ones they want.
export const SUGGESTED_CATEGORIES = [
  { name: 'Groceries',    icon: 'basket-outline',                color: '#5FAD7A' },
  { name: 'Transport',    icon: 'bus',                           color: '#4F8FD6' },
  { name: 'Rent',         icon: 'home-city-outline',             color: '#3FA7A0' },
  { name: 'Bills',        icon: 'lightning-bolt-outline',        color: '#D9A93E' },
  { name: 'Shopping',     icon: 'shopping-outline',              color: '#C96B9A' },
  { name: 'Health',       icon: 'medical-bag',                   color: '#D9605F' },
  { name: 'Travel',       icon: 'airplane',                      color: '#3FA7A0' },
  { name: 'Education',    icon: 'school-outline',                color: '#5C7CBA' },
  { name: 'Gifts',        icon: 'gift-outline',                  color: '#C9788A' },
];

// Names that users cannot give to their own categories.
// "Other" is a built-in tile on the dashboard, so a real category with that name would clash with it.
export const RESERVED_CATEGORY_NAMES = ['other'];
