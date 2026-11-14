import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Pressable } from "@/components/pressable";
import MaterialCommunityIcons from "@/components/icon";
import { confirmAction, showToast } from "@/components/app-dialog";
import { Radius, Type, type AppPalette } from "@/constants/theme";
import type { PortalAssignment, PortalContentInput } from "@fit/contracts";
import { dietMealOptions } from "@fit/contracts";
import { useAuth } from "@/auth/auth-context";
import { useAppTheme } from "@/theme/theme-provider";

function lines(snapshot: PortalContentInput): string[] {
  if (snapshot.kind === "workout")
    return snapshot.data.divisions.flatMap((division) => [
      division.name,
      ...division.exercises.map(
        (ex) =>
          `${ex.name}: ${ex.sets} × ${ex.reps}, ${ex.load ?? "—"} kg, descanso ${ex.restSeconds ?? "—"} s`,
      ),
    ]);
  if (snapshot.kind === "goal")
    return [
      `${snapshot.data.weeklyTarget} treinos por semana`,
      snapshot.data.weekdays.length
        ? `Dias: ${snapshot.data.weekdays.join(", ")} (1 = segunda)`
        : "Meta flexível",
      snapshot.data.notes,
    ];
  if (snapshot.kind === "diet")
    return [
      snapshot.data.objective,
      ...snapshot.data.meals.flatMap((meal) => [
        `${meal.name} ${meal.time || ""}`,
        ...dietMealOptions(meal).flatMap((option) => [
          `${option.name} • ${Math.round(option.macros.calories)} kcal`,
          ...option.items.map(
            (item) =>
              `${item.food.name}: ${item.quantity} ${item.food.servingUnit}${item.substitutions ? ` • Substituições: ${item.substitutions}` : ""}`,
          ),
        ]),
      ]),
      snapshot.data.notes,
    ];
  if (snapshot.kind === "guidance")
    return [
      snapshot.data.objective,
      ...snapshot.data.actions,
      snapshot.data.notes,
    ];
  return [];
}
const statusLabels: Record<string, string> = { pending: "Aguardando seu aceite", active: "Recebido", superseded: "Substituído", declined: "Recusado", cancelled: "Cancelado" };
/** "3 × 12 · 40 kg · descanso 60 s", leaving out what the professional did not set. */
const prescription = (ex: { sets: number; reps: string; load?: number | null; restSeconds?: number | null }) =>
  [`${ex.sets} × ${ex.reps}`, ex.load != null ? `${ex.load} kg` : null, ex.restSeconds != null ? `descanso ${ex.restSeconds} s` : null].filter(Boolean).join(" · ");

export function ProfessionalPlans({ kind }: { kind?: PortalAssignment["snapshot"]["kind"] }) {
  const { api } = useAuth(),
    { colors: c } = useAppTheme(), s = styles(c);
  const [rows, setRows] = useState<PortalAssignment[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setError("");
      const assignments = await api.listProfessionalAssignments();
      setRows(kind ? assignments.filter(row => row.snapshot.kind === kind && (row.status === "pending" || row.status === "active")) : assignments);
    } catch {
      setError("Não foi possível carregar os planos recebidos.");
    } finally {
      setLoading(false);
    }
  }, [api, kind]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const respond = async (row: PortalAssignment, accept: boolean) => {
    const workout = row.snapshot.kind === "workout";
    if (!accept && !(await confirmAction({ title: workout ? "Recusar esta ficha?" : "Recusar este plano?", message: `“${row.snapshot.name}”, de ${row.authorName}, deixará de aparecer como pendente.`, confirmLabel: workout ? "Recusar ficha" : "Recusar plano", cancelLabel: "Voltar", destructive: true }))) return;
    setBusy(true);
    try {
      await api.respondProfessionalAssignment(row.id, accept);
      showToast(accept ? (workout ? "Ficha aceita. Ela já está em Minhas fichas." : "Plano aceito.") : (workout ? "Ficha recusada." : "Plano recusado."));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível responder.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={s.root}>
      <Text accessibilityRole="header" style={s.title}>
        {kind === "workout" ? "Fichas do meu personal" : "Planos recebidos"}
      </Text>
      {loading ? <ActivityIndicator accessibilityLabel="Carregando planos recebidos" color={c.link} /> : null}
      {error ? (
        <View style={s.error}>
          <Text accessibilityRole="alert" style={{ color: c.danger }}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => void load()} style={s.inline}>
            <Text style={s.link}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : null}
      {!loading && !error && !rows.length ? (
        <View style={s.empty}>
          <MaterialCommunityIcons name="account-tie-outline" size={28} color={c.link} />
          <Text style={s.cardTitle}>{kind === "workout" ? "Nenhuma ficha recebida" : "Nenhum plano recebido"}</Text>
          <Text style={[s.muted, s.centered]}>{kind === "workout" ? "Quando seu personal enviar uma ficha pelo vínculo profissional, ela aparece aqui para você aceitar." : "Os planos enviados pelos seus profissionais aparecem aqui."}</Text>
          {kind === "workout" ? <Pressable accessibilityRole="button" onPress={() => router.push("/my-professionals")} style={s.inline}><Text style={s.link}>Ver meus profissionais</Text></Pressable> : null}
        </View>
      ) : null}
      {rows.map((row) => (
        <View key={row.id} style={s.card}>
          <View style={s.cardTop}>
            <View style={s.flex}>
              <Text style={s.cardTitle}>{row.snapshot.name}</Text>
              <Text style={s.muted}>Enviado por {row.authorName}</Text>
            </View>
            <View style={[s.chip, row.status === "pending" && s.chipPending]}>
              <Text style={[s.chipText, row.status === "pending" && { color: c.warning }]}>{statusLabels[row.status] || row.status}</Text>
            </View>
          </View>
          {row.snapshot.kind === "workout"
            ? row.snapshot.data.divisions.map((division, index) => (
                <View key={index} style={s.division}>
                  <Text style={s.divisionTitle}>Treino {String.fromCharCode(65 + index)} · {division.name}</Text>
                  {division.exercises.map((ex, exerciseIndex) => (
                    <View key={exerciseIndex} style={s.exercise}>
                      <Text style={[s.body, s.flex]}>{ex.name}</Text>
                      <Text style={s.muted}>{prescription(ex)}</Text>
                    </View>
                  ))}
                </View>
              ))
            : lines(row.snapshot)
                .filter(Boolean)
                .map((line, index) => (
                  <Text key={index} style={s.body}>{line}</Text>
                ))}
          {row.status === "pending" ? (
            <View style={s.actions}>
              <Pressable accessibilityRole="button" aria-busy={busy} disabled={busy} onPress={() => void respond(row, true)} style={[s.primary, busy && s.disabled]}>
                <Text style={s.primaryText}>{row.snapshot.kind === "workout" ? "Aceitar ficha" : "Aceitar plano"}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void respond(row, false)} style={s.inlineCentered}>
                <Text style={s.danger}>{row.snapshot.kind === "workout" ? "Recusar ficha" : "Recusar plano"}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = (c: AppPalette) => StyleSheet.create({
  root: { gap: 16 }, flex: { flex: 1, minWidth: 0 }, centered: { textAlign: "center" },
  title: { ...Type.headline, fontWeight: "800", color: c.text },
  card: { padding: 16, borderRadius: Radius.xl, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, gap: 12 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardTitle: { ...Type.bodyLarge, fontWeight: "800", color: c.text },
  muted: { ...Type.label, color: c.textMuted }, body: { ...Type.body, color: c.text },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, backgroundColor: c.surfaceSoft },
  chipPending: { backgroundColor: c.warningSoft }, chipText: { ...Type.caption, fontWeight: "800", color: c.textMuted },
  division: { gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border },
  divisionTitle: { ...Type.label, fontWeight: "800", color: c.link },
  exercise: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", columnGap: 12, rowGap: 2 },
  actions: { gap: 4, marginTop: 4 },
  primary: { minHeight: 48, paddingHorizontal: 14, borderRadius: Radius.lg, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" },
  primaryText: { ...Type.body, color: c.onPrimary, fontWeight: "800", textAlign: "center" },
  inline: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }, inlineCentered: { minHeight: 44, justifyContent: "center", alignItems: "center" },
  link: { ...Type.body, color: c.link, fontWeight: "800" }, danger: { ...Type.body, color: c.danger, fontWeight: "700" },
  empty: { padding: 20, borderRadius: Radius.xl, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: "center", gap: 8 },
  error: { backgroundColor: c.dangerSoft, borderRadius: Radius.lg, padding: 12, gap: 4 },
  disabled: { opacity: .5 },
});
