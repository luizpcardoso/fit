import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@/components/icon';
import type { WorkoutExerciseInput } from '@fit/contracts';
import type { AppPalette } from '@/constants/theme';
import { useAppTheme } from '@/theme/theme-provider';
import { formatDecimalValue } from '@/utils/input-format';
import { stepRepetitions, stepWorkoutNumber } from '@/utils/workout-controls';
import { ExerciseThumbnail } from './exercise-thumbnail';
import { FormInput } from './form-input';
import { WorkoutStepper } from './workout-stepper';

type Props = {
  exercise: WorkoutExerciseInput;
  index: number;
  count: number;
  imageUrl?: string | null;
  draft: WorkoutExerciseInput | null;
  error: string;
  onToggle(): void;
  onChange(change: Partial<WorkoutExerciseInput>): void;
  onSave(): void;
  onCancel(): void;
  onMove(direction: -1 | 1): void;
  onRemove(): void;
  onPreview(uri: string): void;
};

/** Saving here updates the plan draft only; persistence belongs to Save plan. */
export function WorkoutExerciseCard({ exercise, index, count, imageUrl, draft, error, onToggle, onChange, onSave, onCancel, onMove, onRemove, onPreview }: Props) {
  const { colors: c } = useAppTheme();
  const s = styles(c);
  const expanded = draft != null;
  return <View style={[s.card, expanded && s.expanded]}>
    <View style={s.header}>
      <ExerciseThumbnail name={exercise.name} uri={imageUrl} onPreview={onPreview}/>
      <Pressable accessibilityRole="button" accessibilityLabel={`Configurar ${exercise.name}`}
        accessibilityHint="Abre ou recolhe a configuração deste exercício"  aria-expanded={expanded}
        onPress={onToggle} style={s.toggle}>
        <View style={s.copy}>
          <Text style={s.name}>{index + 1} · {exercise.name}</Text>
          <Text style={s.summary}>{exercise.sets} séries · {exercise.reps} reps · {exercise.load == null ? 'Sem carga' : `${formatDecimalValue(exercise.load)} kg`} · {exercise.restSeconds == null ? 'Sem descanso' : `${exercise.restSeconds} s descanso`}</Text>
        </View>
        <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={23} color={c.link}/>
      </Pressable>
    </View>
    {draft ? <View style={s.editor}>
      <View style={s.row}>
        <Field label="Séries" styles={s}><WorkoutStepper label={`Séries de ${exercise.name}`}
          value={Number.isFinite(draft.sets) ? String(draft.sets) : ''}
          onChange={value => onChange({ sets: /^\d+$/.test(value) ? Number(value) : NaN })}
          onStep={direction => onChange({ sets: stepWorkoutNumber(draft.sets, direction, 1, 1, 20) })}
          canDecrease={draft.sets > 1} canIncrease={draft.sets < 20}/></Field>
        <Field label="Repetições" styles={s}><WorkoutStepper numeric={false} label={`Repetições de ${exercise.name}`} value={draft.reps}
          onChange={reps => onChange({ reps })}
          onStep={direction => { const reps = stepRepetitions(draft.reps, direction); if (reps) onChange({ reps }); }}
          canDecrease={stepRepetitions(draft.reps, -1) != null} canIncrease={stepRepetitions(draft.reps, 1) != null}/></Field>
      </View>
      <View style={s.row}>
        <Field label="Carga (kg) · passo 0,5" styles={s}><WorkoutStepper label={`Carga de ${exercise.name}`} value={formatDecimalValue(draft.load)}
          onChange={value => onChange({ load: !value.trim() ? null : /^\d+(?:[,.]\d{0,2})?$/.test(value) ? Number(value.replace(',', '.')) : NaN })}
          onStep={direction => onChange({ load: stepWorkoutNumber(draft.load, direction, .5, 0, 2000) })}
          canDecrease={(draft.load ?? 0) > 0} canIncrease={(draft.load ?? 0) < 2000}/></Field>
        <Field label="Descanso (s)" styles={s}><FormInput accessibilityLabel={`Descanso de ${exercise.name}`} keyboardType="number-pad"
          value={draft.restSeconds == null || !Number.isFinite(draft.restSeconds) ? '' : String(draft.restSeconds)}
          onChangeText={value => onChange({ restSeconds: !value.trim() ? null : /^\d+$/.test(value) ? Number(value) : NaN })}
          placeholder="Ex.: 60" style={s.input}/></Field>
      </View>
      <Text style={s.hint}>Repetições aceitam números, faixas (8–12) ou uma orientação.</Text>
      <Field label="Observações" styles={s}><FormInput accessibilityLabel={`Observações de ${exercise.name}`} multiline maxLength={500}
        value={draft.notes ?? ''} onChangeText={notes => onChange({ notes: notes || null })} placeholder="Opcional" style={[s.input, s.notes]}/></Field>
      <View style={s.tools}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Mover ${exercise.name} para cima`} disabled={index === 0} onPress={() => onMove(-1)} style={[s.tool, index === 0 && s.disabled]}><MaterialCommunityIcons name="arrow-up" size={21} color={c.link}/></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Mover ${exercise.name} para baixo`} disabled={index === count - 1} onPress={() => onMove(1)} style={[s.tool, index === count - 1 && s.disabled]}><MaterialCommunityIcons name="arrow-down" size={21} color={c.link}/></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Remover ${exercise.name}`} onPress={onRemove} style={[s.tool, s.remove]}><MaterialCommunityIcons name="trash-can-outline" size={19} color={c.danger}/><Text style={s.danger}>Remover</Text></Pressable>
      </View>
      {error ? <Text accessibilityRole="alert" style={s.danger}>{error}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={`Salvar exercício ${exercise.name}`} onPress={onSave} style={s.save}><Text style={s.saveText}>Salvar exercício</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Cancelar edição de ${exercise.name}`} onPress={onCancel} style={s.cancel}><Text style={s.cancelText}>Cancelar edição</Text></Pressable>
      <Text style={s.hint}>Este ajuste fica no rascunho até você salvar a ficha.</Text>
    </View> : null}
  </View>;
}

function Field({ label, styles: s, children }: { label: string; styles: ReturnType<typeof styles>; children: ReactNode }) {
  return <View style={s.field}><Text style={s.label}>{label}</Text>{children}</View>;
}
const styles = (c: AppPalette) => StyleSheet.create({
  card: { borderWidth: 1, borderColor: c.border, backgroundColor: c.background, borderRadius: 16, padding: 10 },
  expanded: { borderColor: c.link },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggle: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 8 },
  copy: { flex: 1, gap: 5 }, name: { color: c.text, fontWeight: '800', fontSize: 14 },
  summary: { color: c.textMuted, fontSize: 12, lineHeight: 18 },
  editor: { gap: 12, marginTop: 12, paddingTop: 14, borderTopWidth: 1, borderTopColor: c.border },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, field: { flex: 1, minWidth: 136, gap: 6 },
  label: { color: c.textMuted, fontSize: 12, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 12, minHeight: 48 },
  notes: { minHeight: 70, textAlignVertical: 'top' }, hint: { color: c.textMuted, fontSize: 12, lineHeight: 18 },
  tools: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tool: { minWidth: 44, minHeight: 44, borderRadius: 12, backgroundColor: c.surfaceSoft, justifyContent: 'center', alignItems: 'center' },
  remove: { marginLeft: 'auto', flexDirection: 'row', paddingHorizontal: 10, gap: 5 },
  disabled: { opacity: .35 }, danger: { color: c.danger, fontSize: 12, lineHeight: 18 },
  save: { minHeight: 48, borderRadius: 12, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: c.onPrimary, fontWeight: '800', fontSize: 15 },
  cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, cancelText: { color: c.link, fontWeight: '700' },
});
