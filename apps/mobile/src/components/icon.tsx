import Base from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

type Props = ComponentProps<typeof Base>;

/**
 * MaterialCommunityIcons rendered as decoration. Icon fonts draw private-use glyphs; without
 * aria-hidden they leak into the accessible name of the surrounding button ("󰐕 Cadastrar").
 * Controls that are icon-only must carry their own accessibilityLabel.
 */
function MaterialCommunityIcons(props: Props) {
  return <Base aria-hidden accessible={false} importantForAccessibility="no-hide-descendants" {...props} />;
}
MaterialCommunityIcons.glyphMap = Base.glyphMap;

export default MaterialCommunityIcons;
