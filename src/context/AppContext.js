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

