import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { lightColors, darkColors } from '../constants/theme';

export const ThemeContext = createContext({
  themePreference: 'system', // 'system' | 'light' | 'dark'
  setThemePreference: () => {},
  isDark: false,
  colors: lightColors,
});

export function ThemeProvider({ initialTheme = 'system', onSaveTheme, children }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark'
  const [themePreference, setThemePreferenceState] = useState(initialTheme);

  useEffect(() => {
    if (initialTheme) {
      setThemePreferenceState(initialTheme);
    }
  }, [initialTheme]);

  const setThemePreference = (pref) => {
    setThemePreferenceState(pref);
    if (onSaveTheme) {
      onSaveTheme(pref);
    }
  };

  const isDark = useMemo(() => {
    if (themePreference === 'dark') return true;
    if (themePreference === 'light') return false;
    return systemScheme === 'dark';
  }, [themePreference, systemScheme]);

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ themePreference, setThemePreference, isDark, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

// Hook that generates styles using the current theme colors and memoizes them.
// Screen and component JSX does not need any conditional dark mode styling.
export function useThemedStyles(stylesFn) {
  const { colors, isDark } = useTheme();
  return useMemo(() => stylesFn(colors, isDark), [colors, isDark]);
}

