import type { HealthIllustration as Illustration, HealthItem, HealthKind } from '@fit/contracts';
import { SceneThumb, type SceneName } from './scene';

export const healthIllustrations: { value: Illustration; label: string; scene: SceneName }[] = [
  { value: 'tablet', label: 'Comprimido', scene: 'healthTablet' },
  { value: 'capsule', label: 'Cápsula', scene: 'healthCapsule' },
  { value: 'bottle', label: 'Frasco', scene: 'healthBottle' },
  { value: 'drops', label: 'Gotas', scene: 'healthDrops' },
  { value: 'powder', label: 'Suplemento em pó', scene: 'healthPowder' },
  { value: 'shaker', label: 'Coqueteleira', scene: 'healthShaker' },
];
export function HealthIllustration({ item, kind, size = 44 }: { item: Pick<HealthItem, 'illustration'>; kind: HealthKind; size?: number }) {
  const scene = healthIllustrations.find(option => option.value === item.illustration)?.scene ?? (kind === 'medication' ? 'thumbMedication' : 'thumbSupplement');
  return <SceneThumb scene={scene} size={size}/>;
}
