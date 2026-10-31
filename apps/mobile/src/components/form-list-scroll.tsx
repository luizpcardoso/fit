import type { ScrollViewProps } from 'react-native';
import { FormScrollView } from './form-scroll-view';

/** Preserve FlatList virtualization while sharing the form keyboard behavior. */
export function renderFormListScroll(props: ScrollViewProps) {
  return <FormScrollView {...props} />;
}
