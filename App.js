import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, AppState, useColorScheme } from 'react-native';
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
import AnimatedSplash from './src/components/AnimatedSplash';
import * as SplashScreen from 'expo-splash-screen';
import { lightColors, darkColors } from './src/constants/theme';
import { LOCK_AFTER_MS } from './src/constants/security';

// Keep the native splash visible until our animated splash has drawn its first frame
SplashScreen.preventAutoHideAsync().catch(() => {});

// Inner component with access to theme
function MainAppContent({ startDay, setStartDay, biometricEnabled, setBiometricEnabled, locked, setLocked }) {
  const { colors, isDark } = useTheme();
  const handleUnlocked = useCallback(() => setLocked(false), [setLocked]);

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
        <LockScreen onUnlocked={handleUnlocked} />
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
  const leftAppAt = useRef(null); // time the app went to the background
  const systemScheme = useColorScheme(); // phone theme, used before the app theme is ready

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

  // Lock the app when it comes back after being away for more than LOCK_AFTER_MS.
  // A quick switch to another app (to check a payment, for example) does not ask again.
  useEffect(() => {
    if (!biometricEnabled) return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        if (leftAppAt.current === null) {
          leftAppAt.current = Date.now();
        }
        return;
      }
      if (leftAppAt.current !== null) {
        const awayMs = Date.now() - leftAppAt.current;
        leftAppAt.current = null;
        if (awayMs >= LOCK_AFTER_MS) {
          setLocked(true);
        }
      }
    });

    return () => subscription.remove();
  }, [biometricEnabled]);

  if (loading) {
    // The app theme is not loaded yet, so follow the phone theme for this short moment
    const loadingColors = systemScheme === 'dark' ? darkColors : lightColors;
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: loadingColors.background,
        }}
      >
        <StatusBar style={systemScheme === 'dark' ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color={loadingColors.text} />
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
  const [showSplash, setShowSplash] = useState(true);

  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName="expense.db" onInit={initDatabase}>
        <Root />
      </SQLiteProvider>
      {/* Animated logo on top of the app. The app loads underneath while it plays. */}
      {showSplash && <AnimatedSplash onFinish={() => setShowSplash(false)} />}
    </SafeAreaProvider>
  );
}
