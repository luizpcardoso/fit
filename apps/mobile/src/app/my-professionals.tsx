import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import MaterialCommunityIcons from '@/components/icon';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ProfessionalRelationship } from "@fit/contracts";
import { useAuth } from "@/auth/auth-context";
import { useAppTheme } from "@/theme/theme-provider";
import { ProfessionalPlans } from "@/components/professional-plans";
import { confirmAction, showToast } from "@/components/app-dialog";
import { ScreenHeader } from "@/components/screen-header";
import { Radius, Type, type AppPalette } from "@/constants/theme";
import { apiErrorMessage } from "@/utils/api-errors";
import { formatDate, localDate } from "@/utils/dates";

type AreaInfo = { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; sensitive: boolean };
const areas: Record<string, AreaInfo> = {
  fitness: { label: "Treinos", icon: "dumbbell", sensitive: false },
  nutrition: { label: "Diário alimentar e dieta", icon: "food-apple-outline", sensitive: true },
  body: { label: "Medidas corporais", icon: "human", sensitive: true },
  mental: { label: "Saúde mental", icon: "head-heart-outline", sensitive: true },
  groups: { label: "Grupos", icon: "account-group-outline", sensitive: false },
};
const unknownArea: AreaInfo = { label: "Outra área", icon: "shield-outline", sensitive: true };
const actionLabels: Record<string, string> = { view: "Ver", suggest: "Sugerir", manage: "Gerenciar" };
/** O que cada permissão libera, em linguagem simples, para um consentimento informado. */
const capabilityDescriptions: Record<string, string> = {
  "fitness.view": "Ver suas fichas, treinos realizados e metas semanais.",
  "fitness.suggest": "Enviar sugestões de fichas e metas. Nada muda sem o seu aceite.",
  "fitness.manage": "Criar e ajustar fichas e metas diretamente no seu app.",
  "nutrition.view": "Ver seu diário alimentar (refeições e quantidades) e sua dieta.",
  "nutrition.suggest": "Enviar sugestões de dieta. Nada muda sem o seu aceite.",
  "nutrition.manage": "Atribuir e ajustar sua dieta diretamente.",
  "body.view": "Ver suas medidas corporais e a evolução delas.",
  "mental.view": "Ver seus check-ins de bem-estar: humor, emoções e anotações registradas.",
  "mental.suggest": "Enviar orientações de bem-estar. Nada muda sem o seu aceite.",
  "mental.manage": "Atribuir orientações de bem-estar diretamente.",
  "groups.manage": "Convidar você para grupos criados pelo profissional. Você continua decidindo se entra.",
};
const statusLabels: Record<string, string> = {
  pending: "Convite pendente",
  active: "Vínculo ativo",
  ended: "Vínculo encerrado",
  declined: "Convite recusado",
  expired: "Convite expirado",
};
function describeCapability(cap: string) {
  const [areaKey, action] = cap.split(".");
  const area = areas[areaKey] ?? unknownArea;
  return {
    area,
    title: `${area.label}: ${actionLabels[action] ?? "Acesso"}`,
    description: capabilityDescriptions[cap] ?? "Permissão não reconhecida por esta versão do app. Desmarque se não tiver certeza.",
  };
}
const dayOf = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : formatDate(localDate(date)); };
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((item) => b.includes(item));

export default function MyProfessionals() {
  const { api } = useAuth(),
    { colors: c } = useAppTheme();
  const s = styles(c);
  const [rows, setRows] = useState<ProfessionalRelationship[]>([]),
    [chosen, setChosen] = useState<Record<string, string[]>>({}),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState(""),
    [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);
  const load = useCallback(async () => {
    setError("");
    try {
      const result = await api.listProfessionals();
      setRows(result);
      setChosen(
        Object.fromEntries(result.map((row) => [row.id, row.capabilities])),
      );
    } catch (failure) {
      setError(apiErrorMessage(failure, { server: "Não foi possível carregar seus profissionais. Tente novamente." }));
    } finally {
      setLoading(false);
    }
  }, [api]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const act = async (
    row: ProfessionalRelationship,
    action: "accept" | "decline" | "revoke" | "reduce",
  ) => {
    if (busy) return;
    if (action === "decline") {
      const confirmed = await confirmAction({
        title: `Recusar convite de ${row.professionalName}?`,
        message: "O profissional não terá acesso aos seus dados. Para ser acompanhado depois, será necessário um novo convite.",
        confirmLabel: "Recusar convite",
        destructive: true,
      });
      if (!confirmed) return;
    }
    if (action === "revoke") {
      const confirmed = await confirmAction({
        title: `Encerrar vínculo com ${row.professionalName}?`,
        message: `${row.professionalName} deixará de ver seus dados e não poderá mais sugerir nem atribuir planos. Sugestões ainda pendentes serão canceladas. Fichas, dietas e orientações que você já recebeu, e todo o seu histórico, continuam no app. Para voltar a ser acompanhado, será necessário um novo convite.`,
        confirmLabel: "Encerrar vínculo",
        destructive: true,
      });
      if (!confirmed) return;
    }
    setBusy(`${row.id}:${action}`);
    setActionError(null);
    try {
      await api.professionalConsent(
        row.id,
        action,
        ["decline", "revoke"].includes(action) ? [] : chosen[row.id] || [],
      );
      showToast({
        accept: `Convite aceito. ${row.professionalName} já pode acompanhar as áreas autorizadas.`,
        decline: "Convite recusado.",
        revoke: `Vínculo com ${row.professionalName} encerrado.`,
        reduce: "Permissões atualizadas.",
      }[action]);
      await load();
    } catch (failure) {
      setActionError({ id: row.id, message: apiErrorMessage(failure, { conflict: "Este convite ou vínculo mudou. Atualize a tela e tente novamente.", not_found: "Este convite ou vínculo não está mais disponível." }) });
    } finally {
      setBusy(null);
    }
  };
  const toggle = (rowId: string, cap: string) =>
    setChosen((prev) => ({
      ...prev,
      [rowId]: prev[rowId]?.includes(cap)
        ? prev[rowId].filter((item) => item !== cap)
        : [...(prev[rowId] || []), cap],
    }));
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.content}>
        <ScreenHeader backLabel="Início" />
        <Text accessibilityRole="header" style={s.title}>
          Meus profissionais
        </Text>
        <Text style={s.muted}>
          Você controla o acesso aos seus dados. Encerrar um vínculo preserva
          suas fichas, dietas e histórico.
        </Text>
        {loading ? <ActivityIndicator accessibilityLabel="Carregando profissionais" color={c.link} /> : null}
        {error ? (
          <View style={s.errorBox}>
            <Text accessibilityRole="alert" style={s.errorText}>
              {error}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => { setLoading(true); void load(); }} style={s.retry}>
              <Text style={s.link}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : null}
        {!loading && !error && !rows.length ? (
          <View style={s.empty}>
            <MaterialCommunityIcons name="account-tie-outline" size={30} color={c.link} />
            <Text style={s.emptyTitle}>Nenhum profissional por aqui</Text>
            <Text style={s.emptyText}>
              Quando um profissional convidar você pelo e-mail da sua conta, o convite aparecerá aqui para você decidir o que autorizar.
            </Text>
          </View>
        ) : null}
        {rows.map((row) => {
          const selected = chosen[row.id] || [];
          const pending = row.status === "pending";
          const editable = pending || row.status === "active";
          const changed = !sameSet(selected, row.capabilities);
          const rowBusy = busy?.startsWith(`${row.id}:`) ?? false;
          const primaryDisabled = busy !== null || !selected.length || (!pending && !changed);
          return (
          <View key={row.id} style={s.card}>
            <Text style={s.cardTitle}>
              {row.professionalName}
            </Text>
            <Text style={s.muted}>
              {statusLabels[row.status] ?? "Situação indisponível"}
              {pending && dayOf(row.expiresAt) ? ` · válido até ${dayOf(row.expiresAt)}` : ""}
              {row.status === "active" && dayOf(row.createdAt) ? ` · desde ${dayOf(row.createdAt)}` : ""}
            </Text>
            {editable ? (
              <>
                <Text style={s.sectionLabel}>
                  {pending ? "Escolha o que você autoriza:" : "Permissões autorizadas:"}
                </Text>
                {row.capabilities.map((cap) => {
                  const info = describeCapability(cap);
                  const checked = selected.includes(cap);
                  return (
                    <Pressable
                      key={cap}
                      accessibilityRole="checkbox"
                      accessibilityLabel={`${info.title}${info.area.sensitive ? ", dado sensível" : ""}`}
                      accessibilityHint={info.description}
                      aria-checked={checked} aria-disabled={busy !== null}
                      disabled={busy !== null}
                      onPress={() => toggle(row.id, cap)}
                      style={[s.option, checked && s.optionChecked, info.area.sensitive && s.optionSensitive]}
                    >
                      <MaterialCommunityIcons name={checked ? "checkbox-marked" : "checkbox-blank-outline"} size={24} color={checked ? c.link : c.textMuted} />
                      <View style={s.flex}>
                        <View style={s.optionTitleRow}>
                          <MaterialCommunityIcons name={info.area.icon} size={18} color={c.textMuted} />
                          <Text style={s.optionTitle}>{info.title}</Text>
                        </View>
                        <Text style={s.optionDescription}>{info.description}</Text>
                        {info.area.sensitive ? (
                          <View style={s.sensitive}>
                            <MaterialCommunityIcons name="lock-alert-outline" size={16} color={c.warning} />
                            <Text style={s.sensitiveText}>Dado sensível de saúde. Autorize somente se confiar neste profissional.</Text>
                          </View>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
                {!pending ? (
                  <Text style={s.hint}>Você pode retirar permissões a qualquer momento. Para ampliar o acesso, o profissional precisa enviar um novo convite.</Text>
                ) : null}
                {!selected.length ? (
                  <Text style={s.hint}>{pending ? "Selecione ao menos uma permissão para aceitar, ou recuse o convite." : "Para retirar todas as permissões, encerre o vínculo."}</Text>
                ) : null}
                {actionError?.id === row.id ? <Text accessibilityRole="alert" style={s.errorText}>{actionError.message}</Text> : null}
                <Pressable accessibilityRole="button"
                  aria-disabled={primaryDisabled} aria-busy={busy === `${row.id}:accept` || busy === `${row.id}:reduce`}
                  disabled={primaryDisabled}
                  onPress={() => void act(row, pending ? "accept" : "reduce")}
                  style={[s.primary, primaryDisabled && s.disabled]}
                >
                  {busy === `${row.id}:accept` || busy === `${row.id}:reduce` ? <ActivityIndicator color={c.onPrimary} /> : <Text style={s.primaryText}>
                    {pending ? "Aceitar permissões selecionadas" : "Salvar permissões"}
                  </Text>}
                </Pressable>
                <Pressable accessibilityRole="button"
                  aria-disabled={busy !== null} aria-busy={busy === `${row.id}:decline` || busy === `${row.id}:revoke`}
                  disabled={busy !== null}
                  onPress={() => void act(row, pending ? "decline" : "revoke")}
                  style={s.danger}
                >
                  {rowBusy && (busy?.endsWith(":decline") || busy?.endsWith(":revoke")) ? <ActivityIndicator color={c.danger} /> : <Text style={s.dangerText}>
                    {pending ? "Recusar convite" : "Encerrar vínculo"}
                  </Text>}
                </Pressable>
              </>
            ) : null}
          </View>
          );
        })}
        <ProfessionalPlans />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (c: AppPalette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  content: { padding: 20, gap: 16, maxWidth: 760, width: "100%", alignSelf: "center" },
  title: { ...Type.display, fontWeight: "800", color: c.text },
  muted: { ...Type.body, color: c.textMuted },
  link: { ...Type.body, color: c.link, fontWeight: "800" },
  retry: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  errorBox: { backgroundColor: c.dangerSoft, borderRadius: Radius.lg, padding: 12 },
  errorText: { ...Type.label, color: c.danger, fontWeight: "600" },
  empty: { alignItems: "center", gap: 8, padding: 24, borderRadius: Radius.xl, backgroundColor: c.surface },
  emptyTitle: { ...Type.bodyLarge, fontWeight: "800", color: c.text },
  emptyText: { ...Type.label, color: c.textMuted, textAlign: "center" },
  card: { padding: 20, borderRadius: Radius.xl, backgroundColor: c.surface, gap: 12 },
  cardTitle: { ...Type.title, fontWeight: "800", color: c.text },
  sectionLabel: { ...Type.label, fontWeight: "800", color: c.text, marginTop: 4 },
  option: { minHeight: 56, flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 12, borderRadius: Radius.md, borderWidth: 1, borderColor: c.border },
  optionChecked: { borderColor: c.primary },
  optionSensitive: { backgroundColor: c.warningSoft },
  flex: { flex: 1, minWidth: 0 },
  optionTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  optionTitle: { ...Type.body, fontWeight: "800", color: c.text, flexShrink: 1 },
  optionDescription: { ...Type.label, color: c.textMuted, marginTop: 2 },
  sensitive: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 6 },
  sensitiveText: { ...Type.caption, color: c.warning, fontWeight: "700", flex: 1 },
  hint: { ...Type.caption, color: c.textMuted },
  primary: { minHeight: 48, backgroundColor: c.primary, paddingHorizontal: 16, borderRadius: Radius.md, alignItems: "center", justifyContent: "center" },
  primaryText: { ...Type.body, color: c.onPrimary, fontWeight: "800", textAlign: "center" },
  disabled: { opacity: 0.45 },
  danger: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  dangerText: { ...Type.body, color: c.danger, fontWeight: "700" },
});
