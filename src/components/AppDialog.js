import React from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, useThemedStyles, spacing, radius } from '../constants/theme';

export default function AppDialog({ visible, icon, iconColor, title, message, buttons = [], onClose }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Stop tap-through so tapping the card itself doesn't close the dialog */}
        <Pressable style={styles.card} onPress={() => {}}>
          {/* Optional icon */}
          {icon ? (
            <View style={[styles.iconWrap, { backgroundColor: (iconColor || colors.text) + '18' }]}>
              <MaterialCommunityIcons name={icon} size={32} color={iconColor || colors.text} />
            </View>
          ) : null}

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          {/* Buttons */}
          <View style={[styles.buttonsRow, buttons.length === 1 && styles.singleButton]}>
            {buttons.map((btn, i) => {
              const isFull = buttons.length === 1;
              if (btn.style === 'cancel') {
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.btn, styles.cancelBtn, isFull && styles.btnFull]}
                    onPress={btn.onPress}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelText}>{btn.label}</Text>
                  </TouchableOpacity>
                );
              }
              if (btn.style === 'destructive') {
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.btn, styles.destructiveBtn, isFull && styles.btnFull]}
                    onPress={btn.onPress}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.destructiveText}>{btn.label}</Text>
                  </TouchableOpacity>
                );
              }
              // 'default'
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.btn, styles.defaultBtn, isFull && styles.btnFull]}
                  onPress={btn.onPress}
                  activeOpacity={0.8}
                >
                  <Text style={styles.defaultText}>{btn.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.xl,
      width: '100%',
      maxWidth: 360,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 24,
      elevation: 12,
    },
    iconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    message: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: spacing.xl,
    },
    buttonsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      width: '100%',
    },
    singleButton: {
      flexDirection: 'column',
    },
    btn: {
      flex: 1,
      minHeight: 48,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
    },
    btnFull: {
      flex: undefined,
      width: '100%',
    },
    cancelBtn: {
      backgroundColor: colors.chip,
    },
    cancelText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textMuted,
    },
    defaultBtn: {
      backgroundColor: colors.accent,
    },
    defaultText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.accentText,
    },
    destructiveBtn: {
      backgroundColor: colors.expense,
    },
    destructiveText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.onColor,
    },
  });
