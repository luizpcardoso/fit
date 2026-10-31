import MaterialCommunityIcons from '@/components/icon';
import { useState } from 'react';
import { Pressable, View, type StyleProp, type TextInputProps, type TextStyle } from 'react-native';
import { FormInput } from '@/components/form-input';
import { useAuthStyles } from '@/components/auth/auth-shell';
import { useAppTheme } from '@/theme/theme-provider';

/** Password field with a show/hide control so people can check what they typed. */
export function PasswordInput({ style, ...props }: Omit<TextInputProps, 'secureTextEntry' | 'style'> & { style?: StyleProp<TextStyle> }) {
  const styles = useAuthStyles();
  const { colors } = useAppTheme();
  const [visible, setVisible] = useState(false);
  return <View style={styles.passwordWrap}>
    <FormInput autoCapitalize="none" autoCorrect={false} {...props} secureTextEntry={!visible} style={[style, styles.passwordInput]} />
    <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'} aria-expanded={visible} onPress={() => setVisible(value => !value)} style={styles.reveal}>
      <MaterialCommunityIcons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textMuted} />
    </Pressable>
  </View>;
}
