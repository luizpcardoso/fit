import { useState } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { WorkoutIllustrationId } from '@fit/contracts';
import { getWorkoutIllustration, workoutIllustrations } from '@/constants/workout-illustrations';
import { Radius, Scrim, Type } from '@/constants/theme';
import { useAppTheme } from '@/theme/theme-provider';
import MaterialCommunityIcons from '@/components/icon';
import { WorkoutIllustration } from './workout-illustration';

export function WorkoutIllustrationPicker({ value, label, disabled, onChange }: {
  value: WorkoutIllustrationId | null; label: string; disabled: boolean; onChange(value: WorkoutIllustrationId | null): void;
}) {
  const { colors: c } = useAppTheme();
  const [open, setOpen] = useState(false);
  const selected = getWorkoutIllustration(value);
  const choose = (id: WorkoutIllustrationId | null) => { onChange(id); setOpen(false); };
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Imagem do treino ${label}: ${selected?.name ?? 'sem ilustração'}`} aria-disabled={disabled} disabled={disabled} onPress={() => { Keyboard.dismiss(); setOpen(true); }} style={[s.trigger, { borderColor: c.border, backgroundColor: c.surfaceSoft, opacity: disabled ? .5 : 1 }]}>
      <WorkoutIllustration id={value} style={{ width: 96 }}/>
      <View style={s.copy}><Text style={[s.caption, { color: c.textMuted }]}>Imagem do treino</Text><Text numberOfLines={2} style={[s.selectedName, { color: c.text }]}>{selected?.name ?? 'Sem ilustração'}</Text><Text style={[s.caption, { color: c.link }]}>{selected ? 'Alterar imagem' : 'Escolher imagem'}</Text></View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={c.link}/>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Fechar painel de imagens" onPress={() => setOpen(false)}/>
        <SafeAreaView style={[s.sheet, { backgroundColor: c.surface }]}>
          <View style={s.header}><Text accessibilityRole="header" style={[s.title, s.flex, { color: c.text }]}>Imagem do treino {label}</Text><Pressable accessibilityRole="button" accessibilityLabel="Fechar escolha de imagem" onPress={() => setOpen(false)} style={s.close}><MaterialCommunityIcons name="close" size={24} color={c.link}/></Pressable></View>
          <Text style={[s.body, { color: c.textMuted, paddingHorizontal: 16 }]}>Escolha uma região para identificar este treino. A imagem não altera seus exercícios.</Text>
          <ScrollView accessibilityRole="radiogroup" accessibilityLabel="Ilustrações disponíveis" contentContainerStyle={s.options}>
            <Pressable accessibilityRole="radio" accessibilityLabel="Sem ilustração" aria-checked={!selected} onPress={() => choose(null)} style={[s.none, { borderColor: !selected ? c.primary : c.border, backgroundColor: c.surfaceSoft }]}><View style={s.flex}><Text style={[s.label, { color: c.text }]}>Sem ilustração</Text><Text style={[s.caption, { color: c.textMuted }]}>Usar somente o nome e a letra do treino</Text></View><MaterialCommunityIcons name={!selected ? 'radiobox-marked' : 'radiobox-blank'} size={23} color={c.link}/></Pressable>
            {[false, true].map(combination => <View key={String(combination)} style={{ gap: 10 }}>
              <Text accessibilityRole="header" style={[s.label, { color: c.text }]}>{combination ? 'Combinações' : 'Grupos musculares'}</Text>
              <View style={s.grid}>{workoutIllustrations.filter(item => item.combination === combination).map(item => <Pressable key={item.id} accessibilityRole="radio" accessibilityLabel={item.name} aria-checked={value === item.id} onPress={() => choose(item.id)} style={[s.option, { borderColor: value === item.id ? c.primary : c.border, backgroundColor: c.surfaceSoft }]}>
                <WorkoutIllustration id={item.id} style={{ width: '100%' }}/>
                <View style={s.optionLabel}><Text numberOfLines={2} style={[s.optionText, { color: c.text }]}>{item.name}</Text><MaterialCommunityIcons name={value === item.id ? 'radiobox-marked' : 'radiobox-blank'} size={21} color={c.link}/></View>
              </Pressable>)}</View>
            </View>)}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  </>;
}
const s = StyleSheet.create({
  trigger: { minHeight: 112, borderWidth: 1, borderRadius: Radius.lg, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1, gap: 2 }, caption: { ...Type.caption }, body: { ...Type.body }, selectedName: { ...Type.body, minHeight: 44, fontWeight: '700' },
  overlay: { flex: 1, padding: 12, backgroundColor: Scrim, justifyContent: 'center' }, sheet: { width: '100%', maxWidth: 680, maxHeight: '92%', alignSelf: 'center', borderRadius: Radius.xl, overflow: 'hidden', gap: 10 },
  header: { paddingTop: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }, title: { ...Type.title, fontWeight: '800' }, flex: { flex: 1 }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  options: { padding: 16, gap: 20 }, label: { ...Type.body, fontWeight: '700' }, none: { minHeight: 72, borderWidth: 2, padding: 12, borderRadius: Radius.lg, flexDirection: 'row', alignItems: 'center', gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 }, option: { width: '48%', borderWidth: 2, borderRadius: Radius.lg, padding: 6, gap: 6 },
  optionLabel: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 }, optionText: { ...Type.caption, flex: 1, fontWeight: '700' },
});
