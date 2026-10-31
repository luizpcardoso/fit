import { FormScrollView as ScrollView } from '@/components/form-scroll-view';
import { FormInput as TextInput } from '@/components/form-input';
import { useAuth } from "@/auth/auth-context";
import { showToast } from '@/components/app-dialog';
import { ProfileAvatar } from '@/components/profile-avatar';
import { ScreenHeader } from '@/components/screen-header';
import { Radius, Type, type AppPalette } from "@/constants/theme";
import { useAppTheme } from "@/theme/theme-provider";
import {
  birthDateToIso,
  formatBirthDateInput,
  isoDateToBirthDate,
} from "@/utils/date-input";
import { formatIntegerInput } from "@/utils/input-format";
import { useUnsavedChanges } from '@/utils/unsaved-changes';
import MaterialCommunityIcons from '@/components/icon';
import { ApiClientError } from '@fit/api-client';
import type { ActivityLevel, EstimationSex, Gender, PrimaryGoal } from "@fit/contracts";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Option<T> = { value: T; label: string; detail?: string };
const options = {
  gender: [
    { value: "female", label: "Mulher" },
    { value: "male", label: "Homem" },
    { value: "non_binary", label: "Não binário" },
    { value: "prefer_not_to_say", label: "Prefiro não informar" },
  ] as Option<Gender>[],
  estimationSex: [
    { value: "female", label: "Feminino" },
    { value: "male", label: "Masculino" },
  ] as Option<EstimationSex>[],
  activity: [
    { value: "sedentary", label: "Sedentário", detail: "Maior parte do dia sentado, pouca caminhada" },
    { value: "light", label: "Leve", detail: "Caminhadas curtas ou atividade leve 1–3 vezes por semana" },
    { value: "moderate", label: "Moderado", detail: "Exercício moderado 3–5 vezes por semana" },
    { value: "active", label: "Ativo", detail: "Exercício intenso 6–7 vezes por semana" },
    { value: "very_active", label: "Muito ativo", detail: "Treinos diários intensos ou trabalho físico pesado" },
  ] as Option<ActivityLevel>[],
  goal: [
    { value: "lose_weight", label: "Reduzir peso" },
    { value: "maintain", label: "Manter o peso" },
    { value: "gain_muscle", label: "Ganhar massa muscular" },
    { value: "performance", label: "Melhorar desempenho" },
  ] as Option<PrimaryGoal>[],
};
type Errors = Partial<Record<'displayName' | 'username' | 'birthDate' | 'height' | 'form', string>>;
type UsernameStatus = { tone: 'neutral' | 'success' | 'error'; text: string } | null;
const cleanUsername = (value: string) => value.trim().replace(/^@/, "").toLowerCase();

export default function ProfileDetails() {
  const { colors: c } = useAppTheme();
  const s = styles(c);
  const { user, api, updateProfile, updateSocialProfile } = useAuth();
  const initial = {
    displayName: user?.displayName ?? `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim(),
    username: user?.username ?? "",
    birthDate: isoDateToBirthDate(user?.birthDate),
    height: user?.heightCm ? String(user.heightCm) : "",
    gender: user?.gender ?? null,
    estimationSex: user?.estimationSex ?? null,
    activity: user?.activityLevel ?? null,
    goal: user?.primaryGoal ?? null,
  };
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [username, setUsername] = useState(initial.username);
  const [birthDate, setBirthDate] = useState(initial.birthDate);
  const [height, setHeight] = useState(initial.height);
  const [gender, setGender] = useState<Gender | null>(initial.gender);
  const [estimationSex, setEstimationSex] = useState<EstimationSex | null>(initial.estimationSex);
  const [activity, setActivity] = useState<ActivityLevel | null>(initial.activity);
  const [goal, setGoal] = useState<PrimaryGoal | null>(initial.goal);
  const [errors, setErrors] = useState<Errors>({});
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>(null);
  const [busy, setBusy] = useState(false);
  const usernameChanged = cleanUsername(username) !== initial.username;
  const socialChanged = usernameChanged || displayName.trim() !== initial.displayName;
  const profileChanged = birthDate !== initial.birthDate || height !== initial.height || gender !== initial.gender
    || estimationSex !== initial.estimationSex || activity !== initial.activity || goal !== initial.goal;
  useUnsavedChanges(!busy && (socialChanged || profileChanged), 'As alterações do perfil ainda não foram salvas.');

  const checkUsername = () => {
    const value = cleanUsername(username);
    if (!usernameChanged) return setUsernameStatus(null);
    if (!/^[a-z0-9._]{3,30}$/.test(value)) return setUsernameStatus({ tone: 'error', text: 'Use de 3 a 30 caracteres: letras minúsculas, números, ponto ou sublinhado.' });
    setUsernameStatus({ tone: 'neutral', text: 'Verificando disponibilidade…' });
    void api.searchUsers(value)
      .then(users => setUsernameStatus(users.some(found => found.username === value) ? { tone: 'error', text: 'Este @usuário já está em uso.' } : { tone: 'success', text: `@${value} está disponível.` }))
      .catch(() => setUsernameStatus({ tone: 'neutral', text: 'Não foi possível verificar agora. Confirmaremos ao salvar.' }));
  };
  const validate = () => {
    const next: Errors = {};
    if (displayName.trim().length < 2) next.displayName = "Informe um nome com pelo menos 2 caracteres.";
    if (usernameChanged && !/^[a-z0-9._]{3,30}$/.test(cleanUsername(username))) next.username = "Use de 3 a 30 caracteres: letras minúsculas, números, ponto ou sublinhado.";
    if (birthDate.trim() && !birthDateToIso(birthDate)) next.birthDate = "Informe uma data válida no formato DD/MM/AAAA.";
    const heightCm = height.trim() ? Number(height) : null;
    if (heightCm !== null && (!Number.isInteger(heightCm) || heightCm < 80 || heightCm > 250)) next.height = "Informe uma altura entre 80 e 250 cm.";
    return next;
  };
  const save = async () => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      if (socialChanged) await updateSocialProfile({ ...(usernameChanged ? { username: cleanUsername(username) } : {}), displayName: displayName.trim() });
      if (profileChanged) await updateProfile({
        birthDate: birthDate.trim() ? birthDateToIso(birthDate) : null,
        heightCm: height.trim() ? Number(height) : null,
        gender,
        estimationSex,
        activityLevel: activity,
        primaryGoal: goal,
      });
      showToast("Perfil atualizado.");
      void (router.canGoBack() ? router.back() : router.replace("/"));
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409) setErrors({ username: "Este @usuário já está em uso. Escolha outro." });
      else if (error instanceof ApiClientError && error.status === 400) setErrors({ form: "Revise os campos destacados e tente novamente." });
      else setErrors({ form: "Não foi possível salvar. Confira a conexão e tente novamente." });
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
        <ScreenHeader backLabel="Início" showHome={false} />
        <View>
          <Text accessibilityRole="header" style={s.title}>Editar perfil</Text>
          <Text style={s.help}>Nome, foto e @usuário aparecem para os grupos. Os demais dados são privados.</Text>
        </View>

        <Section title="Perfil público" icon="account-circle-outline" s={s}>
          <ProfileAvatar editable />
          <Text style={s.hint}>A foto é salva assim que você a altera ou remove.</Text>
          <Field label="Nome de exibição" error={errors.displayName} s={s}>
            <TextInput accessibilityLabel="Nome de exibição" value={displayName} onChangeText={setDisplayName} maxLength={80} style={[s.input, errors.displayName && s.inputError]} />
          </Field>
          <Field label="@usuário" error={errors.username} hint="Outras pessoas usam este identificador exato para convidar você." s={s}>
            <TextInput accessibilityLabel="@usuário" value={username} onEndEditing={checkUsername} autoCapitalize="none" autoCorrect={false} maxLength={30}
              onChangeText={(value) => { setUsername(value.toLowerCase().replace(/[^a-z0-9._]/g, "")); setUsernameStatus(null); }}
              style={[s.input, errors.username && s.inputError]} />
          </Field>
          {usernameStatus && !errors.username ? <View accessibilityLiveRegion="polite" style={s.status}>
            {usernameStatus.tone === 'neutral' && usernameStatus.text.startsWith('Verificando') ? <ActivityIndicator size="small" color={c.link} /> : <MaterialCommunityIcons name={usernameStatus.tone === 'success' ? 'check-circle' : usernameStatus.tone === 'error' ? 'alert-circle' : 'information'} size={16} color={usernameStatus.tone === 'success' ? c.success : usernameStatus.tone === 'error' ? c.danger : c.textMuted} />}
            <Text style={[s.statusText, usernameStatus.tone === 'success' && { color: c.success }, usernameStatus.tone === 'error' && { color: c.danger }]}>{usernameStatus.text}</Text>
          </View> : null}
        </Section>

        <Section title="Dados para estimativas" subtitle="Privados. Usados só para calcular seu gasto calórico estimado." icon="lock-outline" s={s}>
          <Field label="Data de nascimento" error={errors.birthDate} hint="Digite só os números. Ex.: 07051994 vira 07/05/1994." s={s}>
            <TextInput accessibilityLabel="Data de nascimento" value={birthDate} onChangeText={(value) => setBirthDate(formatBirthDateInput(value))} placeholder="DD/MM/AAAA" keyboardType="number-pad" inputMode="numeric" maxLength={10} style={[s.input, errors.birthDate && s.inputError]} />
          </Field>
          <Field label="Altura (cm)" error={errors.height} s={s}>
            <TextInput accessibilityLabel="Altura em centímetros" value={height} onChangeText={(value) => setHeight(formatIntegerInput(value, 3))} placeholder="Ex.: 174" keyboardType="number-pad" maxLength={3} style={[s.input, errors.height && s.inputError]} />
          </Field>
          <Choice label="Base para estimativas" hint="As fórmulas de gasto calórico usam valores de referência feminino ou masculino. Isso é independente do seu gênero. Sem essa informação, você ainda pode informar o gasto manualmente." value={estimationSex} values={options.estimationSex} onChange={setEstimationSex} s={s} />
        </Section>

        <Section title="Sobre você" subtitle="Opcional e privado." icon="account-details-outline" s={s}>
          <Choice label="Gênero" value={gender} values={options.gender} onChange={setGender} s={s} />
          <Choice label="Nível de atividade" value={activity} values={options.activity} onChange={setActivity} s={s} stacked />
          <Choice label="Objetivo principal" value={goal} values={options.goal} onChange={setGoal} s={s} />
        </Section>

        {errors.form ? <Text accessibilityRole="alert" style={s.error}>{errors.form}</Text> : null}
        {Object.keys(errors).some(key => key !== 'form') ? <Text accessibilityRole="alert" style={s.error}>Revise os campos destacados.</Text> : null}
        <Pressable accessibilityRole="button" aria-disabled={busy} aria-busy={busy} disabled={busy} onPress={() => void save()} style={[s.save, busy && s.disabled]}>
          {busy ? <ActivityIndicator color={c.onPrimary} /> : <Text style={s.saveText}>Salvar perfil</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, subtitle, icon, children, s }: { title: string; subtitle?: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; children: ReactNode; s: ReturnType<typeof styles> }) {
  const { colors: c } = useAppTheme();
  return <View style={s.section}>
    <View style={s.sectionHeading}>
      <MaterialCommunityIcons name={icon} size={20} color={c.link} />
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" style={s.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={s.hint}>{subtitle}</Text> : null}
      </View>
    </View>
    {children}
  </View>;
}
function Field({ label, error, hint, children, s }: { label: string; error?: string; hint?: string; children: ReactNode; s: ReturnType<typeof styles> }) {
  return <View style={s.field}>
    <Text style={s.label}>{label}</Text>
    {children}
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : hint ? <Text style={s.hint}>{hint}</Text> : null}
  </View>;
}
function Choice<T extends string>({ label, hint, value, values, onChange, s, stacked }: { label: string; hint?: string; value: T | null; values: Option<T>[]; onChange: (value: T | null) => void; s: ReturnType<typeof styles>; stacked?: boolean }) {
  const { colors: c } = useAppTheme();
  return <View style={s.field}>
    <Text nativeID={`choice-${label}`} style={s.label}>{label}</Text>
    {hint ? <Text style={s.hint}>{hint}</Text> : null}
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={stacked ? s.choicesStacked : s.choices}>
      {values.map((option) => {
        const selected = value === option.value;
        return <Pressable key={option.value} accessibilityRole="radio" aria-checked={selected} accessibilityHint={selected ? "Toque para limpar a seleção" : undefined}
          onPress={() => onChange(selected ? null : option.value)} style={[s.choice, stacked && s.choiceStacked, selected && s.active]}>
          {stacked ? <MaterialCommunityIcons name={selected ? 'radiobox-marked' : 'radiobox-blank'} size={20} color={selected ? c.onPrimary : c.textMuted} /> : null}
          <View style={stacked ? { flex: 1 } : undefined}>
            <Text style={[s.choiceText, selected && s.activeText]}>{option.label}</Text>
            {option.detail ? <Text style={[s.choiceDetail, selected && s.activeText]}>{option.detail}</Text> : null}
          </View>
        </Pressable>;
      })}
    </View>
  </View>;
}
const styles = (c: AppPalette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    content: { padding: 20, paddingBottom: 50, gap: 20, maxWidth: 720, width: "100%", alignSelf: "center" },
    title: { ...Type.display, fontWeight: "800", color: c.text },
    help: { ...Type.label, color: c.textMuted, marginTop: 4 },
    section: { gap: 14, padding: 16, borderRadius: Radius.xl, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    sectionHeading: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    sectionTitle: { ...Type.bodyLarge, fontWeight: "800", color: c.text },
    field: { gap: 6 },
    label: { ...Type.label, fontWeight: "700", color: c.text },
    hint: { ...Type.caption, color: c.textMuted },
    input: { height: 48, borderRadius: Radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, paddingHorizontal: 14 },
    inputError: { borderColor: c.danger },
    status: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -6 },
    statusText: { ...Type.caption, color: c.textMuted, flex: 1 },
    choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    choicesStacked: { gap: 8 },
    choice: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: c.fieldBorder, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: c.surface },
    choiceStacked: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    active: { backgroundColor: c.primary, borderColor: c.primary },
    choiceText: { ...Type.label, fontWeight: "700", color: c.text },
    choiceDetail: { ...Type.caption, color: c.textMuted, marginTop: 2 },
    activeText: { color: c.onPrimary },
    save: { height: 52, borderRadius: Radius.lg, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" },
    saveText: { ...Type.body, color: c.onPrimary, fontWeight: "800" },
    disabled: { opacity: 0.6 },
    error: { ...Type.caption, color: c.danger, fontWeight: '600' },
  });
