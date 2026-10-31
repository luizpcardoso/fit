import type { PropsWithChildren } from 'react';
import { Platform, View, type ViewProps } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

/** For a fixed composer beside a list; scrollable forms use FormScrollView. */
export function FormKeyboardAvoidingView(props: PropsWithChildren<ViewProps>) {
  if (Platform.OS === 'web') return <View {...props} />;
  return <KeyboardAvoidingView {...props} behavior="padding" automaticOffset />;
}
