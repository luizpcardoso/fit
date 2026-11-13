import type { Injectable, InjectableIllustrationId } from '@fit/contracts';
import { SceneThumb, type SceneName } from './scene';
export const injectableIllustrations: { value: InjectableIllustrationId; label: string; scene: SceneName }[] = [
  { value: 'syringe', label: 'Seringa', scene: 'injectableSyringe' },
  { value: 'ampoule', label: 'Ampola', scene: 'injectableAmpoule' },
  { value: 'vial', label: 'Vial', scene: 'injectableVial' },
  { value: 'vial-reta', label: 'Reta', scene: 'injectableVialReta' },
  { value: 'vial-tirze', label: 'Tirze', scene: 'injectableVialTirze' },
  { value: 'vial-sema', label: 'Sema', scene: 'injectableVialSema' },
  { value: 'vial-dura', label: 'Dura', scene: 'injectableVialDura' },
  { value: 'vial-enan', label: 'Enan', scene: 'injectableVialEnan' },
  { value: 'vial-testo', label: 'Testo', scene: 'injectableVialTesto' },
  { value: 'vial-prop', label: 'prop', scene: 'injectableVialProp' },
  { value: 'vial-pep', label: 'PEP', scene: 'injectableVialPep' },
];
export function InjectableIllustration({ item, size = 48 }: { item: Pick<Injectable, 'illustration'>; size?: number }) {
  return <SceneThumb size={size} scene={injectableIllustrations.find(option => option.value === item.illustration)?.scene ?? 'thumbInjectable'}/>;
}
