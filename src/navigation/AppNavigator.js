import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../constants/theme';
import DashboardScreen from '../screens/DashboardScreen';
import HistoryScreen from '../screens/HistoryScreen';
import PeriodDetailScreen from '../screens/PeriodDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ManageCategoriesScreen from '../screens/ManageCategoriesScreen';

const Tab = createBottomTabNavigator();
const HistoryStack = createNativeStackNavigator();
const SettingsStack = createNativeStackNavigator();

// Header look shared by both stacks
const stackOptions = {
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.background },
  headerTitleStyle: { color: colors.text, fontWeight: '600' },
  headerTintColor: colors.text,
  contentStyle: { backgroundColor: colors.background },
};

// History tab: list of periods -> detail of one period
function HistoryNavigator() {
  return (
    <HistoryStack.Navigator screenOptions={stackOptions}>
      <HistoryStack.Screen name="HistoryList" component={HistoryScreen} options={{ title: 'History' }} />
      <HistoryStack.Screen name="PeriodDetail" component={PeriodDetailScreen} options={{ title: 'Period' }} />
    </HistoryStack.Navigator>
  );
}

// Settings tab: settings -> manage categories
function SettingsNavigator() {
  return (
    <SettingsStack.Navigator screenOptions={stackOptions}>
      <SettingsStack.Screen name="SettingsHome" component={SettingsScreen} options={{ title: 'Settings' }} />
      <SettingsStack.Screen
        name="ManageCategories"
        component={ManageCategoriesScreen}
        options={{ title: 'Categories' }}
      />
    </SettingsStack.Navigator>
  );
}

// Icon for each tab
function tabIcon(name) {
  return ({ color, size }) => <MaterialCommunityIcons name={name} size={size} color={color} />;
}

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 12 },
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarIcon: tabIcon('view-dashboard-outline') }} />
      <Tab.Screen name="History" component={HistoryNavigator} options={{ tabBarIcon: tabIcon('history') }} />
      <Tab.Screen name="Settings" component={SettingsNavigator} options={{ tabBarIcon: tabIcon('cog-outline') }} />
    </Tab.Navigator>
  );
}

