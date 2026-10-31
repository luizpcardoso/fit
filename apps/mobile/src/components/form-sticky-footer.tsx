import { Platform, View, type ViewProps } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Align actions with the keyboard, accounting for the screen's bottom safe area. */
export function FormStickyFooter(props: ViewProps) {
  const insets = useSafeAreaInsets();
  if (Platform.OS === 'web') return <View {...props} />;
  return <KeyboardStickyView {...props} offset={{ opened: insets.bottom }} />;
}
