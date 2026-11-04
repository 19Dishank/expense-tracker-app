import { useState, useCallback } from 'react';

// Hook that drives <AppDialog>.
//
// Usage:
//   const { dialogProps, showDialog, showConfirm, showInfo } = useDialog();
//   ...
//   <AppDialog {...dialogProps} />
//
// showConfirm(title, message, onConfirm, { icon?, iconColor? })
//   Shows a Cancel + action button dialog. onConfirm runs when the action button is tapped.
//
// showInfo(title, message, { icon?, iconColor? })
//   Shows a single OK button.
//
// showDialog(config)  — full control, matches AppDialog props minus visible/onClose.

export function useDialog() {
  const [state, setState] = useState({ visible: false });

  const close = useCallback(() => setState((s) => ({ ...s, visible: false })), []);

  const showDialog = useCallback((config) => {
    setState({ ...config, visible: true });
  }, []);

  const showConfirm = useCallback(
    (title, message, onConfirm, { icon = 'alert-circle-outline', iconColor, actionLabel = 'Confirm', destructive = true } = {}) => {
      showDialog({
        icon,
        iconColor,
        title,
        message,
        buttons: [
          { label: 'Cancel', style: 'cancel', onPress: close },
          {
            label: actionLabel,
            style: destructive ? 'destructive' : 'default',
            onPress: () => {
              close();
              onConfirm();
            },
          },
        ],
        onClose: close,
      });
    },
    [showDialog, close]
  );

  const showInfo = useCallback(
    (title, message, { icon = 'information-outline', iconColor } = {}) => {
      showDialog({
        icon,
        iconColor,
        title,
        message,
        buttons: [{ label: 'OK', style: 'default', onPress: close }],
        onClose: close,
      });
    },
    [showDialog, close]
  );

  return { dialogProps: state, showDialog, showConfirm, showInfo, closeDialog: close };
}

