import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/theme/theme-provider';

type Region = { label: string; line: [number, number, number]; description: string };
const regions: Record<string, Region> = {
  waistCm: { label: 'Cintura', line: [74, 126, 115], description: 'Entre a última costela palpável e o topo do osso do quadril. Mantenha a fita horizontal.' },
  abdomenCm: { label: 'Abdômen', line: [72, 128, 132], description: 'Região abdominal, na altura do umbigo. Use sempre o mesmo ponto nas próximas medições.' },
  hipsCm: { label: 'Quadril', line: [67, 133, 157], description: 'Circunferência na parte mais larga dos glúteos, com a fita horizontal.' },
  chestCm: { label: 'Peito', line: [70, 130, 86], description: 'Circunferência do tórax. Mantenha o mesmo nível e a mesma postura nos registros.' },
  leftArmCm: { label: 'Braço esquerdo', line: [139, 158, 104], description: 'Seu braço esquerdo: região entre ombro e cotovelo. Repita no mesmo ponto e posição.' },
  rightArmCm: { label: 'Braço direito', line: [42, 61, 104], description: 'Seu braço direito: região entre ombro e cotovelo. Repita no mesmo ponto e posição.' },
  leftThighCm: { label: 'Coxa esquerda', line: [107, 132, 198], description: 'Sua coxa esquerda: entre quadril e joelho. Use sempre o mesmo ponto de referência.' },
  rightThighCm: { label: 'Coxa direita', line: [68, 93, 198], description: 'Sua coxa direita: entre quadril e joelho. Use sempre o mesmo ponto de referência.' },
};
export function BodyMeasurementGuide({ selected, onSelect }: { selected: string; onSelect(key: string): void }) {
  const { colors: c } = useAppTheme(); const region = regions[selected];
  const bands = Object.entries(regions).map(([key, r]) => `<line x1="${r.line[0]}" x2="${r.line[1]}" y1="${r.line[2]}" y2="${r.line[2]}" stroke="${key === selected ? c.link : c.border}" stroke-width="${key === selected ? 7 : 2}" stroke-linecap="round"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 320"><g fill="${c.surfaceSoft}" stroke="${c.textMuted}" stroke-width="2"><circle cx="100" cy="24" r="19"/><path d="M87 44 L87 53 L62 64 Q53 66 49 84 L32 156 Q29 166 37 167 Q44 168 47 157 L66 94 L74 117 L68 150 Q62 169 66 195 L72 287 Q71 300 65 306 L89 306 L97 197 Q100 187 103 197 L111 306 L135 306 Q129 300 128 287 L134 195 Q138 169 132 150 L126 117 L134 94 L153 157 Q156 168 163 167 Q171 166 168 156 L151 84 Q147 66 138 64 L113 53 L113 44"/></g>${bands}<circle cx="100" cy="132" r="2" fill="${c.textMuted}"/></svg>`;
  return <View style={{ backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 }}>
    <Text style={{ color: c.text, fontWeight: '800' }}>Onde medir</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Image source={{ uri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` }} contentFit="contain" style={{ width: 110, height: 180 }} accessible alt={`Corpo de frente. Região destacada: ${region?.label ?? 'nenhuma'}. Direita e esquerda correspondem ao seu corpo.`} accessibilityLabel={`Corpo de frente. Região destacada: ${region?.label ?? 'nenhuma'}. Direita e esquerda correspondem ao seu corpo.`}/><View style={{ flex: 1, gap: 6 }}><Text accessibilityLiveRegion="polite" style={{ color: c.link, fontWeight: '800' }}>{region?.label ?? 'Selecione uma medida'}</Text><Text style={{ color: c.textMuted, fontSize: 12, lineHeight: 18 }}>{region?.description ?? 'Toque em uma região ou em um campo abaixo. O desenho mostra as regiões de forma aproximada.'}</Text></View></View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{Object.entries(regions).map(([key, r]) => <Pressable key={key} accessibilityRole="radio" aria-checked={selected === key} onPress={() => onSelect(key)} style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: 'center', borderRadius: 12, backgroundColor: key === selected ? c.primarySoft : c.surfaceSoft }}><Text style={{ color: key === selected ? c.link : c.textMuted, fontSize: 12 }}>{key === selected ? '✓ ' : ''}{r.label}</Text></Pressable>)}</View>
    <Text style={{ color: c.textMuted, fontSize: 12 }}>Ilustração de localização, sem escala. Mantenha o protocolo orientado pelo profissional que acompanha você.</Text>
  </View>;
}
