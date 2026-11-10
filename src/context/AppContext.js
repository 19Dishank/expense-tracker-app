import { createContext, useContext } from 'react';

// Shares the "first setup is done" flag and the biometric lock setting with every screen.
// App.js fills it in; Settings can change it.
export const AppContext = createContext({
  setupDone: false,
  setSetupDone: () => {},
  biometricEnabled: false,
  setBiometricEnabled: () => {},
});

// Small helper so screens can write: const { setupDone } = useAppContext();
export function useAppContext() {
  return useContext(AppContext);
}
