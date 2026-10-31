import { forwardRef, type ComponentRef } from 'react';
import { StyleSheet, TextInput, type TextInputProps, type TextStyle } from 'react-native';
import { useAppTheme } from '@/theme/theme-provider';

/** Field outlines need 3:1 against the surface (WCAG 1.4.11); decorative card borders do not. */
function fieldOutline(style: Partial<TextStyle> | null | undefined, colors: { border: string; fieldBorder: string; danger: string }) {
  if (!style?.borderWidth && !style?.borderBottomWidth) return null;
  return style.borderColor === colors.danger ? null : { borderColor: colors.fieldBorder };
}

/** Shared defaults; individual forms retain their layout and accessibility labels. */
export const FormInput = forwardRef<ComponentRef<typeof TextInput>, TextInputProps>(function FormInput({ style, ...props }, ref) {
  const { colors, scheme } = useAppTheme();
  return <TextInput ref={ref} keyboardAppearance={scheme} placeholderTextColor={colors.textMuted}
    selectionColor={colors.link} cursorColor={colors.link} {...props}
    style={[{ color: colors.text, backgroundColor: colors.surface, minHeight: 44 }, style, fieldOutline(StyleSheet.flatten(style), colors), { fontSize: Math.max(16, StyleSheet.flatten(style)?.fontSize ?? 16) }]} />;
});
