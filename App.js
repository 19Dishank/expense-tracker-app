import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { initDatabase, getSetting } from './src/db/database';
import { AppContext } from './src/context/AppContext';
import SetupScreen from './src/screens/SetupScreen';
import AppNavigator from './src/navigation/AppNavigator';
import { colors } from './src/constants/theme';

// Navigation colors match our theme
const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.background, card: colors.surface },
};

// Decides which screen to show: setup (first launch) or the main app
function Root() {
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(true);
  const [startDay, setStartDay] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const saved = await getSetting(db, 'period_start_day');
        console.log('Saved period start day:', saved);
        if (saved) {
          setStartDay(parseInt(saved, 10));
        }
      } catch (e) {
        console.log('App root load error:', e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [db]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  // First launch: ask for the start day
  if (!startDay) {
    return <SetupScreen onDone={setStartDay} />;
  }

  return (
    <AppContext.Provider value={{ startDay, setStartDay }}>
      <NavigationContainer theme={navTheme}>
        <AppNavigator />
      </NavigationContainer>
    </AppContext.Provider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SQLiteProvider databaseName="expense.db" onInit={initDatabase}>
        <Root />
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
