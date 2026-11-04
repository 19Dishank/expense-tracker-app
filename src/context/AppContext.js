import { createContext, useContext } from 'react';

// Shares the period start day and biometric lock setting with every screen.
// App.js fills it in; Settings can change it.
export const AppContext = createContext({
  startDay: 15,
  setStartDay: () => {},
  biometricEnabled: false,
  setBiometricEnabled: () => {},
});

// Small helper so screens can write: const { startDay } = useAppContext();
export function useAppContext() {
  return useContext(AppContext);
}
