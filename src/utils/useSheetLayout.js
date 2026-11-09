import { useEffect, useState } from 'react';
import { Keyboard, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Layout numbers for bottom sheets.
//   maxSheetHeight = the tallest the sheet may be: screen height, minus the keyboard, minus the status bar.
//                    Without a limit a tall sheet grows past the top of the screen and its top cannot be reached.
//   bottomInset    = height of the phone's navigation bar / gesture bar, so the Save button is never under it.
export function useSheetLayout() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return {
    maxSheetHeight: Math.max(height - keyboardHeight - insets.top - 8, 200),
    bottomInset: insets.bottom,
  };
}

