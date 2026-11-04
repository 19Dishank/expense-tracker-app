import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { initDatabase, getSetting, setSetting } from './src/db/database';
import { AppContext } from './src/context/AppContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import SetupScreen from './src/screens/SetupScreen';
import AppNavigator from './src/navigation/AppNavigator';
import LockScreen from './src/screens/LockScreen';

// Inner component with access to theme
function MainAppContent({ startDay, setStartDay, biometricEnabled, setBiometricEnabled, locked, setLocked }) {
  const { colors, isDark } = useTheme();

  const navTheme = isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: colors.background,
          card: colors.surface,
          border: colors.border,
          text: colors.text,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: colors.background,
          card: colors.surface,
          border: colors.border,
          text: colors.text,
        },
      };

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {locked ? (
        <LockScreen onUnlocked={() => setLocked(false)} />
      ) : !startDay ? (
        <SetupScreen onDone={setStartDay} />
      ) : (
        <AppContext.Provider value={{ startDay, setStartDay, biometricEnabled, setBiometricEnabled }}>
          <NavigationContainer theme={navTheme}>
            <AppNavigator />
          </NavigationContainer>
        </AppContext.Provider>
      )}
    </>
  );
}

// Decides which screen to show: setup (first launch) or the main app
function Root() {
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(true);
  const [startDay, setStartDay] = useState(null);
  const [themePreference, setThemePreference] = useState('system');

  // Biometric lock state
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const saved = await getSetting(db, 'period_start_day');
        if (saved) {
          setStartDay(parseInt(saved, 10));
        }

        // Load theme preference ('system' | 'light' | 'dark')
        const savedTheme = await getSetting(db, 'theme_preference');
        if (savedTheme) {
          setThemePreference(savedTheme);
        }

        // Load biometric lock setting
        const bioSetting = await getSetting(db, 'biometric_lock');
        const isEnabled = bioSetting === 'true';
        setBiometricEnabled(isEnabled);
        if (isEnabled) {
          setLocked(true);
        }
      } catch (e) {
        console.log('App root load error:', e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [db]);

  // Lock the app whenever it comes back to the foreground
  useEffect(() => {
    if (!biometricEnabled) return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        setLocked(true);
      }
    });

    return () => subscription.remove();
  }, [biometricEnabled]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider
      initialTheme={themePreference}
      onSaveTheme={(pref) => setSetting(db, 'theme_preference', pref)}
    >
      <MainAppContent
        startDay={startDay}
        setStartDay={setStartDay}
        biometricEnabled={biometricEnabled}
        setBiometricEnabled={setBiometricEnabled}
        locked={locked}
        setLocked={setLocked}
      />
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName="expense.db" onInit={initDatabase}>
        <Root />
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
