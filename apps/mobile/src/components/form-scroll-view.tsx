import { forwardRef, type ComponentRef } from 'react';
import { Platform, ScrollView, type ScrollViewProps } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

type FormScrollViewProps = ScrollViewProps & {
  /** Space occupied by actions that remain above the keyboard. */
  bottomOffset?: number;
  /** Sheets and centered forms must reflow when keyboard space is added. */
  keyboardLayout?: 'insets' | 'layout';
};

/** One keyboard owner: do not nest this inside a KeyboardAvoidingView. */
export const FormScrollView = forwardRef<ComponentRef<typeof ScrollView>, FormScrollViewProps>(function FormScrollView(
  { bottomOffset = 16, keyboardLayout = 'insets', ...props }, ref,
) {
  if (Platform.OS === 'web' || props.horizontal) {
    return <ScrollView ref={ref} keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'web' ? 'none' : 'on-drag'} {...props} />;
  }
  return <KeyboardAwareScrollView ref={instance => {
    if (typeof ref === 'function') ref(instance);
    else if (ref) ref.current = instance;
  }} bottomOffset={bottomOffset} mode={keyboardLayout}
    keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" {...props}
    automaticallyAdjustKeyboardInsets={false} />;
});
