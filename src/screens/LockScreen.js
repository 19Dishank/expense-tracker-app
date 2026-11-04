import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, useThemedStyles, spacing, radius } from '../constants/theme';

// Full-screen lock shown at app open when biometric lock is enabled.
// Calls onUnlocked() as soon as authentication succeeds.
export default function LockScreen({ onUnlocked }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [supported, setSupported] = useState(true);

  const authenticate = useCallback(async () => {
    setError('');
    setChecking(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        // Device doesn't support biometrics or none enrolled — unlock automatically
        // so the app is not locked out permanently
        console.log('Biometrics not available/enrolled, auto-unlocking');
        onUnlocked();
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Expense Tracker',
        fallbackLabel: 'Use PIN / Password',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        onUnlocked();
      } else if (result.error === 'user_cancel' || result.error === 'system_cancel') {
        setError('Authentication cancelled. Tap to try again.');
      } else {
        setError('Authentication failed. Tap to try again.');
      }
    } catch (e) {
      console.log('Biometric auth error:', e.message);
      // If something goes wrong with the API, let the user in rather than locking them out
      setError('Biometrics unavailable. Tap to try again.');
      setSupported(false);
    } finally {
      setChecking(false);
    }
  }, [onUnlocked]);

  // Attempt on mount
  useEffect(() => {
    authenticate();
  }, [authenticate]);

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="fingerprint" size={72} color={colors.accent} />
        </View>

        <Text style={styles.title}>Expense Tracker</Text>
        <Text style={styles.subtitle}>Authenticate to continue</Text>

        {checking && <ActivityIndicator style={styles.spinner} color={colors.accent} />}

        {!checking && error !== '' && (
          <Text style={styles.error}>{error}</Text>
        )}

        {!checking && (
          <TouchableOpacity style={styles.button} onPress={authenticate} activeOpacity={0.8}>
            <MaterialCommunityIcons name="fingerprint" size={20} color="#FFF" />
            <Text style={styles.buttonText}>
              {supported ? 'Authenticate' : 'Try Again'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.footer}>All data stays on this phone.</Text>
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  inner: {
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  spinner: {
    marginTop: spacing.lg,
  },
  error: {
    fontSize: 14,
    color: colors.expense,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accentText,
  },
  footer: {
    position: 'absolute',
    bottom: spacing.xl,
    fontSize: 13,
    color: colors.textMuted,
  },
});

