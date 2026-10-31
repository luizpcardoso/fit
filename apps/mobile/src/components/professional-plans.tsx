import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
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
export function ProfessionalPlans({ kind }: { kind?: PortalAssignment["snapshot"]["kind"] }) {
  const { api } = useAuth(),
    { colors: c } = useAppTheme();
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
  const respond = async (id: string, accept: boolean) => {
    setBusy(true);
    try {
      await api.respondProfessionalAssignment(id, accept);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível responder.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "800", color: c.text }}>
        {kind === "workout" ? "Fichas do meu personal" : "Planos recebidos"}
      </Text>
      {loading ? <ActivityIndicator color={c.link} /> : null}
      {error ? (
        <>
          <Text accessibilityRole="alert" style={{ color: c.danger }}>
            {error}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => void load()} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
            <Text style={{ color: c.link, fontWeight: "800" }}>Tentar novamente</Text>
          </Pressable>
        </>
      ) : null}
      {!loading && !error && !rows.length ? (
        <Text style={{ color: c.textMuted }}>{kind === "workout" ? "Nenhuma ficha disponível. Seu personal precisa enviar um treino pelo vínculo profissional." : "Nenhum plano recebido."}</Text>
      ) : null}
      {rows.map((row) => (
        <View
          key={row.id}
          style={{
            padding: 20,
            borderRadius: 20,
            backgroundColor: c.surface,
            gap: 12,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: "800", color: c.text }}>
            {row.snapshot.name}
          </Text>
          <Text style={{ color: c.textMuted }}>
            {row.authorName} •{" "}
            {(
              {
                pending: "Aguardando seu aceite",
                active: "Recebido",
                superseded: "Substituído",
                declined: "Recusado",
                cancelled: "Cancelado",
              } as Record<string, string>
            )[row.status] || row.status}{" "}
            • versão {row.sourceRevision}
          </Text>
          {lines(row.snapshot)
            .filter(Boolean)
            .map((line, index) => (
              <Text key={index} style={{ color: c.text }}>
                {line}
              </Text>
            ))}
          {row.status === "pending" ? (
            <>
              <Pressable accessibilityRole="button"
                disabled={busy}
                onPress={() => void respond(row.id, true)}
                style={{
                  minHeight: 48,
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: c.primary,
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: c.onPrimary, fontWeight: "800", textAlign: "center" }}>
                  {row.snapshot.kind === "workout" ? "Aceitar ficha" : "Aceitar plano"}
                </Text>
              </Pressable>
              <Pressable accessibilityRole="button"
                disabled={busy}
                onPress={() => void respond(row.id, false)}
                style={{ minHeight: 44, justifyContent: "center", alignItems: "center" }}
              >
                <Text style={{ color: c.danger, fontWeight: "700" }}>{row.snapshot.kind === "workout" ? "Recusar ficha" : "Recusar plano"}</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      ))}
    </View>
  );
}
