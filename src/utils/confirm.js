import { Alert } from 'react-native';

// Shows a "Cancel / Delete" dialog. onConfirm runs only if the user taps Delete.
export function confirmDelete(title, message, onConfirm) {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}

