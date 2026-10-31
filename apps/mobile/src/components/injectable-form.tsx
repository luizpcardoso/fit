import { FormScrollView as ScrollView } from '@/components/form-scroll-view';
import { FormInput as TextInput } from '@/components/form-input';
import { InformationModal } from "@/components/information-modal";
import type { AppPalette } from "@/constants/theme";
import { useAppTheme } from "@/theme/theme-provider";
import { formatDecimalInput, formatDecimalValue } from "@/utils/input-format";
import {
  injectableInputSchema,
  type Injectable,
  type InjectableInput,
  type InjectableUnit,
} from "@fit/contracts";
import MaterialCommunityIcons from '@/components/icon';
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const weekdays = [
  ["Seg", 1],
  ["Ter", 2],
  ["Qua", 3],
  ["Qui", 4],
  ["Sex", 5],
  ["Sáb", 6],
  ["Dom", 7],
] as const;
const units: { key: InjectableUnit; label: string }[] = [
  { key: "mg", label: "mg" },
  { key: "ml", label: "mL" },
  { key: "iu", label: "UI" },
  { key: "clicks", label: "Cliques" },
  { key: "other", label: "Outra" },
];
const parseNumber = (value: string) => Number(value.replace(",", "."));
export function InjectableForm({
  initial,
  onClose,
  onSave,
}: {
  initial: Injectable | null;
  onClose(): void;
  onSave(input: InjectableInput, active: boolean): Promise<void>;
}) {
  const { colors: c, scheme } = useAppTheme();
  const s = styles(c);
  const [name, setName] = useState(initial?.name ?? "");
  const [dose, setDose] = useState(formatDecimalValue(initial?.dose));
  const [unit, setUnit] = useState<InjectableUnit>(initial?.unit ?? "mg");
  const [customUnit, setCustomUnit] = useState(initial?.customUnit ?? "");
  const [selectedDays, setSelectedDays] = useState<number[]>(
    initial?.weekdays ?? [],
  );
  const [halfLife, setHalfLife] = useState(
    formatDecimalValue(initial?.halfLifeDays),
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState(false);
  const tirzepatide = name.trim().toLocaleLowerCase("pt-BR").includes("tirzep");
  const toggleDay = (day: number) =>
    setSelectedDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort(),
    );
  const submit = async () => {
    const parsed = injectableInputSchema.safeParse({
      name,
      dose: parseNumber(dose),
      unit,
      customUnit: unit === "other" ? customUnit.trim() || null : null,
      weekdays: selectedDays,
      halfLifeDays: halfLife.trim() ? parseNumber(halfLife) : null,
      notes: notes.trim() || null,
    });
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ?? "Revise os dados informados.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave(parsed.data, active);
    } catch {
      setError("Não foi possível salvar o injetável. Confira a conexão e tente novamente.");
      setBusy(false);
    }
  };
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
        <View style={s.header}>
          <Pressable accessibilityRole="button"
            accessibilityLabel="Fechar cadastro de injetável"
            onPress={onClose}
            style={s.close}
          >
            <MaterialCommunityIcons name="close" size={22} color={c.text} />
          </Pressable>
          <View style={s.grow}>
            <Text accessibilityRole="header" style={s.title}>
              {initial ? "Editar injetável" : "Novo injetável"}
            </Text>
            <Text style={s.subtitle}>Use somente conforme sua prescrição</Text>
          </View>
          <Pressable accessibilityRole="button"
            accessibilityLabel="Sobre o cadastro de injetáveis"
            onPress={() => setInfo(true)}
            style={s.info}
          >
            <MaterialCommunityIcons
              name="information-outline"
              size={21}
              color={c.link}
            />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.warning}>
            <MaterialCommunityIcons
              name="shield-alert-outline"
              size={22}
              color={c.warning}
            />
            <Text style={s.warningText}>
              O Fit registra sua rotina, mas não define dose, frequência nem
              substitui orientação profissional.
            </Text>
          </View>
          <Field label="Nome" help="Como você identifica o produto">
            <TextInput
              keyboardAppearance={scheme}
              editable={!busy}
              value={name}
              onChangeText={setName}
              maxLength={100}
              placeholder="Ex.: Tirzepatida"
              placeholderTextColor={c.textMuted}
              style={s.input}
            />
          </Field>
          <View style={s.twoColumns}>
            <View style={s.column}>
              <Field label="Dose por aplicação">
                <TextInput
                  keyboardAppearance={scheme}
                  editable={!busy}
                  value={dose}
                  onChangeText={(value) =>
                    setDose(formatDecimalInput(value, 6, 3))
                  }
                  keyboardType="decimal-pad"
                  placeholder="Ex.: 5"
                  placeholderTextColor={c.textMuted}
                  style={s.input}
                />
              </Field>
            </View>
            <View style={s.column}>
              <Text style={s.label}>Unidade</Text>
              <Text style={s.help}>Sem conversão automática</Text>
              <View style={s.units}>
                {units.map((item) => (
                  <Pressable
                    key={item.key}
                    accessibilityRole="radio"
                    aria-checked={unit === item.key}
                    onPress={() => setUnit(item.key)}
                    style={[s.unit, unit === item.key && s.unitSelected]}
                  >
                    <Text
                      style={[
                        s.unitText,
                        unit === item.key && s.unitTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
          {unit === "other" ? (
            <Field label="Unidade personalizada">
              <TextInput
                keyboardAppearance={scheme}
                editable={!busy}
                value={customUnit}
                onChangeText={setCustomUnit}
                maxLength={30}
                placeholder="Ex.: doses"
                placeholderTextColor={c.textMuted}
                style={s.input}
              />
            </Field>
          ) : null}
          {unit === "clicks" ? (
            <View style={s.hint}>
              <MaterialCommunityIcons
                name="information-outline"
                size={19}
                color={c.link}
              />
              <Text style={s.hintText}>
                Cliques variam conforme o dispositivo. O Fit registra o número
                informado e não converte para mg ou mL.
              </Text>
            </View>
          ) : null}
          <View>
            <Text style={s.sectionTitle}>Dias de aplicação</Text>
            <Text style={s.help}>
              Selecione apenas os dias definidos na sua prescrição.
            </Text>
          </View>
          <View accessibilityRole="radiogroup" style={s.week}>
            {weekdays.map(([label, day]) => {
              const selected = selectedDays.includes(day);
              return (
                <Pressable
                  key={day}
                  accessibilityRole="checkbox"
                  accessibilityLabel={label}
                  aria-checked={selected}
                  onPress={() => toggleDay(day)}
                  style={[s.day, selected && s.daySelected]}
                >
                  <Text style={[s.dayText, selected && s.dayTextSelected]}>
                    {label.slice(0, 1)}
                  </Text>
                  <Text style={[s.daySmall, selected && s.dayTextSelected]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {tirzepatide ? (
            <View style={s.tirzepatide}>
              <MaterialCommunityIcons
                name="medical-bag"
                size={21}
                color={c.warning}
              />
              <View style={s.grow}>
                <Text style={s.tirzepatideTitle}>
                  Referência para tirzepatida
                </Text>
                <Text style={s.tirzepatideText}>
                  A bula aprovada descreve uso uma vez por semana e meia-vida
                  aproximada de 5 dias. Siga a frequência e a dose prescritas;
                  não use o gráfico para alterar o tratamento.
                </Text>
                {selectedDays.length > 1 ? (
                  <Text style={s.tirzepatideAlert}>
                    Você selecionou mais de um dia na semana. Confirme essa
                    orientação com seu profissional.
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}
          <Field
            label="Meia-vida estimada (opcional)"
            help="Em dias; consulte a bula ou o profissional que acompanha você"
          >
            <View style={s.inputWithSuffix}>
              <TextInput
                keyboardAppearance={scheme}
                editable={!busy}
                value={halfLife}
                onChangeText={(value) =>
                  setHalfLife(formatDecimalInput(value, 3, 2))
                }
                keyboardType="decimal-pad"
                placeholder="Ex.: 5"
                placeholderTextColor={c.textMuted}
                style={s.suffixInput}
              />
              <Text style={s.suffix}>dias</Text>
            </View>
          </Field>
          <View style={s.hint}>
            <MaterialCommunityIcons
              name="chart-bell-curve-cumulative"
              size={19}
              color={c.link}
            />
            <Text style={s.hintText}>
              A meia-vida gera apenas uma estimativa matemática da quantidade
              no organismo. Ela não mede concentração no sangue.
            </Text>
          </View>
          <Field label="Observações" help="Opcional">
            <TextInput
              keyboardAppearance={scheme}
              editable={!busy}
              value={notes}
              onChangeText={setNotes}
              multiline
              maxLength={500}
              textAlignVertical="top"
              placeholder="Ex.: Aplicar conforme orientação médica."
              placeholderTextColor={c.textMuted}
              style={[s.input, s.notes]}
            />
          </Field>
          {initial ? (
            <View style={s.activeRow}>
              <View style={s.grow}>
                <Text style={s.activeTitle}>Acompanhamento ativo</Text>
                <Text style={s.help}>
                  Itens pausados não aparecem na rotina de hoje.
                </Text>
              </View>
              <Switch
                value={active}
                onValueChange={setActive}
                trackColor={{ false: c.controlTrackOff, true: c.primary }}
                thumbColor={c.controlThumb}
              />
            </View>
          ) : null}
          {error ? (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void submit()}
            style={[s.save, busy && s.disabled]}
          >
            {busy ? (
              <ActivityIndicator color={c.onPrimary} />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="check"
                  size={20}
                  color={c.onPrimary}
                />
                <Text style={s.saveText}>Salvar injetável</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
        {info ? (
          <InformationModal
            title="Cadastro de injetáveis"
            paragraphs={[
              "Cadastre exatamente a dose, unidade, frequência e meia-vida orientadas pelo profissional ou informadas na bula do seu produto. O Fit não prescreve nem valida tratamentos.",
              "mg, mL, UI e cliques representam medidas diferentes. O aplicativo não converte entre elas. Cliques podem variar entre dispositivos e devem ser conferidos nas instruções do fabricante.",
              "A estimativa de meia-vida usa um decaimento matemático simples. Absorção, metabolismo, formulação, horário e características individuais podem fazer o comportamento real ser diferente.",
            ]}
            onClose={() => setInfo(false)}
          />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}
function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  const { colors: c } = useAppTheme();
  const s = styles(c);
  return (
    <View>
      <Text style={s.label}>{label}</Text>
      {help ? <Text style={s.help}>{help}</Text> : null}
      <View style={s.fieldContent}>{children}</View>
    </View>
  );
}
const styles = (c: AppPalette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      padding: 16,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    close: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: c.surfaceSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    grow: { flex: 1, minWidth: 0 },
    title: { fontSize: 20, fontWeight: "800", color: c.text },
    subtitle: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    info: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: c.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      padding: 20,
      paddingBottom: 45,
      gap: 18,
      maxWidth: 720,
      width: "100%",
      alignSelf: "center",
    },
    warning: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 9,
      backgroundColor: c.warningSoft,
      borderRadius: 16,
      padding: 13,
    },
    warningText: { flex: 1, color: c.textMuted, fontSize: 12, lineHeight: 17 },
    label: { fontSize: 13, fontWeight: "800", color: c.text },
    help: { fontSize: 12, color: c.textMuted, lineHeight: 15, marginTop: 3 },
    fieldContent: { marginTop: 8 },
    input: {
      color: c.text,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      paddingHorizontal: 13,
      paddingVertical: 12,
      fontSize: 13,
    },
    twoColumns: {
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
      flexWrap: "wrap",
    },
    column: { flex: 1, minWidth: 210 },
    units: { flexDirection: "row", gap: 5, flexWrap: "wrap", marginTop: 8 },
    unit: {
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: 10,
      borderRadius: 12,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    unitSelected: { backgroundColor: c.primary, borderColor: c.primary },
    unitText: { color: c.textMuted, fontSize: 12, fontWeight: "800" },
    unitTextSelected: { color: c.onPrimary },
    hint: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: c.primarySoft,
      borderRadius: 16,
      padding: 12,
    },
    hintText: { flex: 1, color: c.link, fontSize: 12, lineHeight: 16 },
    sectionTitle: { fontSize: 16, fontWeight: "800", color: c.text },
    week: { flexDirection: "row", gap: 6, justifyContent: "space-between" },
    day: {
      flex: 1,
      minWidth: 39,
      maxWidth: 70,
      aspectRatio: 0.9,
      borderRadius: 16,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
    },
    daySelected: { backgroundColor: c.primary, borderColor: c.primary },
    dayText: { color: c.text, fontSize: 14, fontWeight: "800" },
    daySmall: { color: c.textMuted, fontSize: 12, fontWeight: "700" },
    dayTextSelected: { color: c.onPrimary },
    tirzepatide: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      backgroundColor: c.warningSoft,
      borderRadius: 16,
      padding: 13,
    },
    tirzepatideTitle: { color: c.text, fontSize: 12, fontWeight: "800" },
    tirzepatideText: {
      color: c.textMuted,
      fontSize: 12,
      lineHeight: 16,
      marginTop: 3,
    },
    tirzepatideAlert: {
      color: c.warning,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "800",
      marginTop: 6,
    },
    inputWithSuffix: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      overflow: "hidden",
    },
    suffixInput: {
      flex: 1,
      color: c.text,
      paddingHorizontal: 13,
      paddingVertical: 12,
      fontSize: 13,
    },
    suffix: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: "800",
      paddingRight: 13,
    },
    notes: { minHeight: 90 },
    activeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      padding: 13,
    },
    activeTitle: { fontSize: 13, fontWeight: "800", color: c.text },
    error: { color: c.danger, fontSize: 12 },
    save: {
      backgroundColor: c.primary,
      borderRadius: 16,
      padding: 15,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    saveText: { color: c.onPrimary, fontWeight: "800" },
    disabled: { opacity: 0.6 },
  });
