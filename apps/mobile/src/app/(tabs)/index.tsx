import { HomeNutrition } from '@/components/home-nutrition';
import { useAppTheme } from "@/theme/theme-provider";
import { Scrim, Type, type AppPalette } from "@/constants/theme";
import MaterialCommunityIcons from '@/components/icon';
import type {
  GroupDashboard,
  GroupSummary,
  HealthKind,
  WorkoutGoalInput,
  WorkoutGoalSummary,
  WorkoutPlan,
} from "@fit/contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {Image} from 'expo-image';
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/auth/auth-context";
import { HealthTodayModal } from "@/components/health-today-modal";
import { CardShadow } from "@/constants/theme";
import {
  localDay,
  useHealthClock,
  useHealthRoutine,
} from "@/hooks/use-health-routine";
import { WorkoutGoalForm } from "@/components/workout-goal-form";
import { CardioSection } from "@/components/cardio-section";
import { HomeShortcuts, QuickRegisterSheet } from "@/components/home-shortcuts";
import { useInjectablesToday } from "@/hooks/use-injectables-today";
import { InjectablesTodayModal } from "@/components/injectables-today-modal";
import { confirmAction } from "@/components/app-dialog";
import { useHomePreferences } from "@/utils/home-preferences";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type DailyActivity = {
  id: string;
  title: string;
  detail: string;
  icon: IconName;
  done: boolean;
  open(): void;
  toggle?(): Promise<void>;
};

const weekdays = [
  { short: "Seg", full: "segunda-feira" },
  { short: "Ter", full: "terça-feira" },
  { short: "Qua", full: "quarta-feira" },
  { short: "Qui", full: "quinta-feira" },
  { short: "Sex", full: "sexta-feira" },
  { short: "Sáb", full: "sábado" },
  { short: "Dom", full: "domingo" },
];

export default function HomeScreen() {
  const { colors: c, scheme } = useAppTheme();
  const s = createStyles(c, scheme);
  const { showEnergyBalance } = useHomePreferences();

  const { user, api, logout } = useAuth();
  const [nutritionRevision, setNutritionRevision] = useState(0);
  const [goal, setGoal] = useState<WorkoutGoalSummary | null>(null);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalError, setGoalError] = useState("");
  const [healthOpen, setHealthOpen] = useState<HealthKind | null>(null);
  const [injectablesOpen, setInjectablesOpen] = useState(false);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [groupDashboard, setGroupDashboard] = useState<GroupDashboard>({
    totalUnseen: 0,
    pendingInvites: 0,
    notificationsUnread: 0,
  });
  const [activeGroupId, setActiveGroupId] = useState("");
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickRegisterOpen, setQuickRegisterOpen] = useState(false);
  const [activitiesOpen, setActivitiesOpen] = useState(false);
  const actionLock = useRef(false);
  const [activityBusy, setActivityBusy] = useState('');
  const [activityError, setActivityError] = useState('');
  const [mentalDone, setMentalDone] = useState<boolean | "error" | null>(null);
  const [groupsState, setGroupsState] = useState<"loading" | "ready" | "error">("loading");
  const today = useHealthClock();
  const todayKey = localDay(today);
  const refreshGoal = useCallback(async () => {
    try {
      const [summary, savedPlans] = await Promise.all([
        api.getWorkoutGoal(todayKey),
        api.listWorkoutPlans(),
      ]);
      setGoal(summary);
      setPlans(savedPlans);
      setGoalError("");
    } catch {
      setGoalError("Não foi possível carregar sua meta semanal.");
    }
  }, [api, todayKey]);
  useFocusEffect(
    useCallback(() => {
      void refreshGoal();
    }, [refreshGoal]),
  );
  const refreshMental = useCallback(async () => {
    try {
      setMentalDone(
        (await api.listMentalCheckIns(todayKey, todayKey)).length > 0,
      );
    } catch {
      setMentalDone("error");
    }
  }, [api, todayKey]);
  useFocusEffect(
    useCallback(() => {
      void refreshMental();
    }, [refreshMental]),
  );
  const refreshGroups = useCallback(async () => {
    try {
      const [items, dashboard] = await Promise.all([
        api.listGroups(),
        api.getGroupsDashboard(),
      ]);
      setGroups(items);
      setGroupDashboard(dashboard);
      setGroupsState("ready");
      setActiveGroupId((current) =>
        items.some((group) => group.id === current)
          ? current
          : (items[0]?.id ?? ""),
      );
    } catch {
      setGroupsState("error");
    }
  }, [api]);
  useFocusEffect(
    useCallback(() => {
      void refreshGroups();
    }, [refreshGroups]),
  );
  const supplements = useHealthRoutine("supplement", todayKey);
  const medications = useHealthRoutine("medication", todayKey);
  const injectables = useInjectablesToday(todayKey);
  const activeRoutine = healthOpen === "medication" ? medications : supplements;
  const activeGroup =
    groups.find((group) => group.id === activeGroupId) ?? groups[0];
  const firstName = user?.firstName.trim().split(/\s+/)[0] || "Atleta";
  // Never show a target the person did not choose: an unconfigured goal is an invitation, not "0/3".
  const goalConfigured = Boolean(goal?.configured);
  const weeklyGoal = goal?.weeklyTarget ?? 0;
  const completedWorkouts = goal?.completed ?? 0;
  const remaining = goal?.remaining ?? 0;
  const progress = goalConfigured && weeklyGoal ? Math.min(completedWorkouts / weeklyGoal, 1) : 0;
  const hasPlans = plans.some((plan) => plan.isActive);
  const formattedDate = today.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const weekDates = Array.from({ length: 7 }, (_, index) => {
    const base = goal?.weekStart
      ? new Date(`${goal.weekStart}T12:00:00`)
      : new Date(today);
    if (!goal?.weekStart)
      base.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    base.setDate(base.getDate() + index);
    return localDay(base);
  });
  const divisionsById = new Map(
    plans.flatMap((plan) =>
      plan.divisions.map((division) => [division.id, division] as const),
    ),
  );
  const saveGoal = async (input: WorkoutGoalInput) => {
    setGoalSaving(true);
    setGoalError("");
    try {
      await api.updateWorkoutGoal(input);
      await refreshGoal();
      setGoalOpen(false);
    } catch (error) {
      setGoalError(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar sua meta.",
      );
    } finally {
      setGoalSaving(false);
    }
  };
  const todayWeekday = ((today.getDay() + 6) % 7) + 1;
  const plannedToday = goal?.schedule.find(
    (item) => item.weekday === todayWeekday,
  );
  const plannedDivision = plannedToday?.divisionId
    ? divisionsById.get(plannedToday.divisionId)
    : null;
  const dailyActivities: DailyActivity[] = [
    ...(medications.daily?.items.map((entry) => ({
      id: `medication:${entry.item.id}:${entry.slot}`,
      title: entry.item.name,
      detail: `Medicamento${entry.time ? ` · ${entry.time}` : ""}`,
      icon: "pill" as IconName,
      done: Boolean(entry.consumedAt),
      open: () => setHealthOpen("medication"),
      toggle: async () => { await api.setHealthIntake('medication', entry.item.id, todayKey, entry.slot, !entry.consumedAt); if (!await medications.refresh()) throw new Error('refresh'); },
    })) ?? []),
    ...(supplements.daily?.items.map((entry) => ({
      id: `supplement:${entry.item.id}:${entry.slot}`,
      title: entry.item.name,
      detail: `Suplemento${entry.time ? ` · ${entry.time}` : ""}`,
      icon: "shaker-outline" as IconName,
      done: Boolean(entry.consumedAt),
      open: () => setHealthOpen("supplement"),
      toggle: async () => { await api.setHealthIntake('supplement', entry.item.id, todayKey, entry.slot, !entry.consumedAt); if (!await supplements.refresh()) throw new Error('refresh'); },
    })) ?? []),
    ...(injectables.daily?.items.map((entry) => ({
      id: `injectable:${entry.injectable.id}`,
      title: entry.injectable.name,
      detail: "Aplicação prevista",
      icon: "needle" as IconName,
      done: Boolean(entry.application),
      open: () => setInjectablesOpen(true),
    })) ?? []),
    {
      id: "mental-check-in",
      title: "Como você está se sentindo?",
      detail: mentalDone === "error" ? "Não foi possível verificar agora" : "Check-in da Mente",
      icon: "head-heart-outline",
      done: mentalDone === true,
      open: () => router.push("/mental-wellbeing"),
    },
    ...(plannedToday
      ? [
          {
            id: "planned-workout",
            title: plannedDivision
              ? `Treino ${plannedDivision.label} · ${plannedDivision.name}`
              : "Treino planejado",
            detail: "Treino planejado para hoje",
            icon: "dumbbell" as IconName,
            done: (goal?.sessionsByDate[todayKey] ?? 0) > 0,
            open: () => router.push("/workout-run"),
          },
        ]
      : []),
  ];
  const toggleActivity = async (activity: DailyActivity) => {
    if (actionLock.current || !activity.toggle) return;
    if (localDay() !== todayKey) { setActivityError('O dia mudou. Aguarde a atualização antes de registrar.'); return; }
    actionLock.current = true; setActivityBusy(activity.id); setActivityError('');
    try { await activity.toggle(); }
    catch { setActivityError('Não foi possível confirmar a alteração. Atualize a rotina antes de tentar novamente.'); await Promise.all([medications.refresh(), supplements.refresh()]); }
    finally { actionLock.current = false; setActivityBusy(''); }
  };
  const completedActivities = dailyActivities.filter(
    (item) => item.done,
  ).length;
  const activitiesLoading =
    medications.loading ||
    supplements.loading ||
    injectables.loading ||
    mentalDone === null ||
    (!goal && !goalError);
  const nextActivity = dailyActivities.find((item) => !item.done);
  const activityProgress = dailyActivities.length
    ? completedActivities / dailyActivities.length
    : 0;
  const openDailyActivity = (activity: DailyActivity) => {
    setActivitiesOpen(false);
    activity.open();
  };

  return (
    <View style={s.root}>
      <SafeAreaView style={s.safe} edges={["top"]}>
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Editar perfil"
              onPress={() => router.push("/profile-details")}
              style={s.avatar}
            >
              {user?.avatarUrl?<Image source={{uri:user.avatarUrl}} style={{width:48,height:48,borderRadius: 20}}/>:<Text style={s.avatarText}>
                {firstName[0].toLocaleUpperCase("pt-BR")}
              </Text>}
            </Pressable>
            <View style={s.headerCopy}>
              <Text style={s.date}>{formattedDate}</Text>
              <Text accessibilityRole="header" style={s.greeting}>
                Olá, {firstName}
              </Text>
              <Text style={s.subtitle}>Vamos cuidar da sua rotina hoje?</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abrir menu"
              onPress={() => setMenuOpen(true)}
              style={s.menuButton}
            >
              <MaterialCommunityIcons name="menu" size={25} color={c.link} />
            </Pressable>
          </View>

          <View style={s.todayOverview}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ver atividades de hoje"
              onPress={() => setActivitiesOpen(true)}
              style={[s.todayCard, CardShadow]}
            >
              <View style={s.todayTop}>
                <View style={s.todayIcon}>
                  <MaterialCommunityIcons
                    name="calendar-check-outline"
                    size={21}
                    color={c.link}
                  />
                </View>
                <View style={s.flex}>
                  <Text style={s.todayLabel}>Hoje</Text>
                  <Text style={s.todayTitle}>
                    {activitiesLoading
                      ? "Atualizando…"
                      : `${completedActivities} de ${dailyActivities.length} ${dailyActivities.length === 1 ? "atividade" : "atividades"}`}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color={c.textMuted}
                />
              </View>
              <View style={s.todayTrack}>
                <View
                  style={[s.todayFill, { width: `${activityProgress * 100}%` }]}
                />
              </View>
              <Text numberOfLines={1} style={s.todayNext}>
                {activitiesLoading
                  ? "Buscando sua rotina do dia"
                  : nextActivity
                    ? `Próxima: ${nextActivity.title}`
                    : "Tudo concluído por hoje ✓"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Registrar: treino, refeição, cardio e mais"
              onPress={() => setQuickRegisterOpen(true)}
              style={[s.quickRegisterCompact, CardShadow]}
            >
              <View style={s.quickRegisterIcon}>
                <MaterialCommunityIcons name="plus" size={22} color={c.onPrimary} />
              </View>
              <Text style={s.quickRegisterTitle}>Registrar</Text>
              <Text numberOfLines={2} style={s.quickRegisterText}>Treino, refeição e mais</Text>
            </Pressable>
          </View>

          <View style={s.hero}>
            <View style={s.heroTop}>
              <View style={s.heroIcon}>
                <MaterialCommunityIcons
                  name="dumbbell"
                  size={21}
                  color={c.primaryStrong}
                />
              </View>
              <View style={s.flex}>
                <Text style={s.heroEyebrow}>Fitness</Text>
                <Text style={s.heroTitle}>Treinos e cardio</Text>
              </View>
              <Pressable accessibilityRole="button"
                accessibilityLabel={goalConfigured ? "Ajustar meta semanal" : "Definir meta semanal"}
                onPress={() => setGoalOpen(true)}
                style={s.heroAdjust}
              >
                <MaterialCommunityIcons
                  name="tune-variant"
                  size={20}
                  color={c.onHero}
                />
              </Pressable>
            </View>
            {!goal && goalError ? (
              <View style={s.heroNotice}>
                <Text accessibilityRole="alert" style={s.heroCaption}>{goalError}</Text>
                <Pressable accessibilityRole="button" onPress={() => void refreshGoal()} style={s.heroInlineAction}>
                  <Text style={s.heroInlineActionText}>Tentar novamente</Text>
                </Pressable>
              </View>
            ) : goal && !goalConfigured ? (
              <View style={s.heroNotice}>
                <Text style={s.heroCaption}>
                  {completedWorkouts
                    ? `${completedWorkouts} ${completedWorkouts === 1 ? "treino realizado" : "treinos realizados"} nesta semana`
                    : "Quantas vezes por semana você quer treinar?"}
                </Text>
                <Text style={s.heroHint}>Defina uma meta semanal para acompanhar seu ritmo. Treinos em qualquer dia da semana contam.</Text>
                <Pressable accessibilityRole="button" onPress={() => setGoalOpen(true)} style={s.heroInlineAction}>
                  <Text style={s.heroInlineActionText}>Definir meta semanal</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View accessible accessibilityLabel={goal ? `${completedWorkouts} de ${weeklyGoal} treinos nesta semana. ${remaining ? `Faltam ${remaining}.` : "Meta da semana concluída."}` : "Carregando meta semanal"} style={s.heroProgress}>
                  <Text style={s.heroNumber}>
                    {completedWorkouts}
                    <Text style={s.heroTotal}>/{goal ? weeklyGoal : "–"}</Text>
                  </Text>
                  <View style={s.flex}>
                    <Text style={s.heroCaption}>treinos nesta semana</Text>
                    <Text style={s.heroHint}>
                      {!goal
                        ? "Carregando sua meta…"
                        : remaining
                          ? `Faltam ${remaining} para a meta da semana`
                          : "Meta da semana concluída"}
                    </Text>
                  </View>
                </View>
                <View style={s.track}>
                  <View style={[s.fill, { width: `${progress * 100}%` }]} />
                </View>
              </>
            )}
            <View style={s.week}>
              {weekdays.map((day, index) => {
                const date = weekDates[index];
                const sessions = goal?.sessionsByDate[date] ?? 0;
                const scheduled = goal?.schedule.find(
                  (item) => item.weekday === index + 1,
                );
                const division = scheduled?.divisionId
                  ? divisionsById.get(scheduled.divisionId)
                  : null;
                const planLabel = division?.label ?? "";
                const doneLabel = sessions > 1 ? `${sessions} treinos realizados` : sessions === 1 ? "treino realizado" : "";
                const status =
                  sessions > 1
                    ? `${sessions}×`
                    : sessions === 1
                      ? "✓"
                      : planLabel || (scheduled ? "•" : "—");
                return (
                  <View
                    key={day.short}
                    accessible
                    accessibilityLabel={[
                      day.full,
                      division ? `treino ${division.label} planejado: ${division.name}` : scheduled ? "treino planejado" : "",
                      doneLabel || (scheduled ? "ainda não realizado" : "sem treino"),
                    ].filter(Boolean).join(", ")}
                    style={[
                      s.day,
                      sessions > 0 && s.dayDone,
                      scheduled && sessions === 0 && s.dayPlanned,
                    ]}
                  >
                    <Text style={[s.dayText, sessions > 0 && s.dayTextDone]}>
                      {day.short}
                    </Text>
                    <Text
                      style={[
                        s.dayStatus,
                        sessions > 0 && s.dayStatusDone,
                        planLabel && sessions === 0 && s.dayStatusPlanned,
                      ]}
                    >
                      {status}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={s.fitnessActions}>
              <Pressable accessibilityRole="button"
                onPress={() => router.push(hasPlans || !goal ? "/workout-run" : "/workout-create")}
                style={s.heroButton}
              >
                <MaterialCommunityIcons
                  name={hasPlans || !goal ? "play" : "plus"}
                  size={18}
                  color={c.primaryStrong}
                />
                <Text style={s.heroButtonText}>{hasPlans || !goal ? "Treinar" : "Criar ficha"}</Text>
              </Pressable>
              <Pressable accessibilityRole="button"
                onPress={() => router.push("/workouts")}
                style={s.fitnessLink}
              >
                <Text style={s.fitnessLinkText}>Ver Fitness</Text>
                <MaterialCommunityIcons
                  name="arrow-right"
                  size={16}
                  color={c.heroMuted}
                />
              </Pressable>
            </View>
            <CardioSection date={todayKey} compact onChanged={() => setNutritionRevision(value => value + 1)} />
          </View>

          {showEnergyBalance ? <HomeNutrition key={`${todayKey}:${nutritionRevision}`} date={todayKey} /> : null}
          <HomeShortcuts />

          <View style={s.sectionHeading}>
            <View>
              <Text style={s.sectionTitle}>Sua comunidade</Text>
              <Text style={s.sectionSubtitle}>
                Treinar junto ajuda a manter o ritmo
              </Text>
            </View>
          </View>
          <View style={[s.communityCard, CardShadow]}>
            {groupsState === "loading" && !groups.length ? (
              <ActivityIndicator color={c.link} accessibilityLabel="Carregando grupos" />
            ) : groupsState === "error" && !groups.length ? (
              <View style={s.communityTop}>
                <View style={s.flex}>
                  <Text accessibilityRole="alert" style={s.routineTitle}>Não foi possível carregar seus grupos</Text>
                  <Text style={s.routineStatus}>Confira a conexão e tente novamente.</Text>
                </View>
                <Pressable accessibilityRole="button" onPress={() => void refreshGroups()} style={s.inlineRetry}>
                  <Text style={s.communityActionText}>Tentar novamente</Text>
                </Pressable>
              </View>
            ) : activeGroup ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Trocar grupo ativo"
                  aria-expanded={groupPickerOpen}
                  onPress={() => setGroupPickerOpen((open) => !open)}
                  style={s.communityTop}
                >
                  <View style={s.groupIcon}>
                    <MaterialCommunityIcons
                      name="account-group-outline"
                      size={24}
                      color={c.link}
                    />
                  </View>
                  <View style={s.flex}>
                    <Text style={s.routineTitle}>{activeGroup.name}</Text>
                    <Text style={s.routineStatus}>
                      {activeGroup.memberCount} {activeGroup.memberCount === 1 ? "participante" : "participantes"}
                      {activeGroup.unseenCount
                        ? ` · ${activeGroup.unseenCount} ${activeGroup.unseenCount === 1 ? "novidade" : "novidades"}`
                        : ""}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name={groupPickerOpen ? "chevron-up" : "chevron-down"}
                    size={23}
                    color={c.textMuted}
                  />
                </Pressable>
                {groupPickerOpen ? (
                  <View style={s.groupOptions}>
                    {groups.map((group) => (
                      <Pressable accessibilityRole="radio"
                        aria-selected={group.id === activeGroupId}
                        accessibilityLabel={`${group.name}${group.unseenCount ? `, ${group.unseenCount} novidades` : ""}`}
                        key={group.id}
                        onPress={() => {
                          setActiveGroupId(group.id);
                          setGroupPickerOpen(false);
                        }}
                        style={[
                          s.groupOption,
                          group.id === activeGroupId && s.groupOptionSelected,
                        ]}
                      >
                        <Text style={s.groupOptionText}>{group.name}</Text>
                        <Text style={s.groupOptionCount}>
                          {group.unseenCount || ""}
                        </Text>
                        {group.id === activeGroupId ? (
                          <MaterialCommunityIcons
                            name="check"
                            size={18}
                            color={c.link}
                          />
                        ) : null}
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <Pressable accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: "/group-detail",
                      params: { id: activeGroup.id },
                    })
                  }
                  style={s.communityAction}
                >
                  <Text style={s.communityActionText}>Abrir feed do grupo</Text>
                  <MaterialCommunityIcons
                    name="arrow-right"
                    size={18}
                    color={c.link}
                  />
                </Pressable>
              </>
            ) : (
              <Pressable accessibilityRole="button"
                onPress={() => router.push("/groups")}
                style={s.communityTop}
              >
                <View style={s.groupIcon}>
                  <MaterialCommunityIcons
                    name="account-group-outline"
                    size={24}
                    color={c.link}
                  />
                </View>
                <View style={s.flex}>
                  <Text style={s.routineTitle}>Crie seu primeiro grupo</Text>
                  <Text style={s.routineStatus}>
                    Compartilhe conquistas com pessoas de confiança
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="arrow-right"
                  size={20}
                  color={c.link}
                />
              </Pressable>
            )}
          </View>
          {groupDashboard.totalUnseen ||
          groupDashboard.pendingInvites ||
          groupDashboard.notificationsUnread ? (
            <Pressable accessibilityRole="button"
              onPress={() => router.push("/group-notifications")}
              style={s.socialUpdates}
            >
              <MaterialCommunityIcons
                name="bell-outline"
                size={20}
                color={c.notificationText}
              />
              <Text style={s.socialUpdatesText}>
                {groupDashboard.totalUnseen} {groupDashboard.totalUnseen === 1 ? "nova atualização" : "novas atualizações"}
                {groupDashboard.pendingInvites
                  ? ` · ${groupDashboard.pendingInvites} convite${groupDashboard.pendingInvites > 1 ? "s" : ""}`
                  : ""}
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={18}
                color={c.notificationText}
              />
            </Pressable>
          ) : null}
          <Text style={s.disclaimer}>
            Apenas atividades autorizadas por você e pelo grupo aparecem no
            feed.
          </Text>
        </ScrollView>
        <Modal
          transparent
          visible={activitiesOpen}
          animationType="slide"
          onRequestClose={() => setActivitiesOpen(false)}
        >
          <View style={s.activitiesOverlay}>
            {/* Backdrop is a sibling, not a parent, so sheet controls are never nested buttons. */}
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar atividades" style={StyleSheet.absoluteFill} onPress={() => setActivitiesOpen(false)} />
            <SafeAreaView style={s.activitiesSheet} edges={["bottom"]}>
              <View>
                <View style={s.sheetHandle} />
                <View style={s.activitiesHeader}>
                  <View style={s.flex}>
                    <Text style={s.activitiesTitle}>Atividades de hoje</Text>
                    <Text style={s.activitiesSubtitle}>
                      {activitiesLoading
                        ? "Atualizando sua rotina…"
                        : `${completedActivities} de ${dailyActivities.length} ${dailyActivities.length === 1 ? "concluída" : "concluídas"}`}
                    </Text>
                  </View>
                  <Pressable accessibilityRole="button"
                    accessibilityLabel="Fechar atividades de hoje"
                    onPress={() => setActivitiesOpen(false)}
                    style={s.activitiesClose}
                  >
                    <MaterialCommunityIcons
                      name="close"
                      size={20}
                      color={c.textMuted}
                    />
                  </Pressable>
                </View>
                <ScrollView contentContainerStyle={s.activitiesList}>
                  {activityError ? <Text accessibilityRole="alert" style={{ color: c.danger, paddingVertical: 12 }}>{activityError}</Text> : null}
                  {medications.error || supplements.error ? <Text accessibilityRole="alert" style={{ color: c.danger }}>{medications.error || supplements.error}</Text> : null}
                  {dailyActivities.map((activity) => (
                    <View key={activity.id} style={s.activityRow}>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Ver ${activity.title}`} onPress={() => openDailyActivity(activity)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 60 }}>
                        <View style={[s.activityIcon, activity.done && s.activityIconDone]}><MaterialCommunityIcons name={activity.done ? 'check' : activity.icon} size={20} color={activity.done ? c.background : c.link} /></View>
                        <View style={s.flex}><Text style={[s.activityTitle, activity.done && s.activityTitleDone]}>{activity.title}</Text><Text style={s.activityDetail}>{activity.done ? 'Concluído' : activity.detail}</Text></View>
                      </Pressable>
                      {activity.toggle ? <Pressable accessibilityRole="checkbox" aria-checked={activity.done} accessibilityLabel={`${activity.done ? 'Desfazer tomada de' : 'Registrar tomada de'} ${activity.title}`} aria-disabled={Boolean(activityBusy)} disabled={Boolean(activityBusy) || Boolean(medications.error || supplements.error)} onPress={() => void toggleActivity(activity)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                        {activityBusy === activity.id ? <ActivityIndicator color={c.link} /> : <MaterialCommunityIcons name={activity.done ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} size={28} color={activity.done ? c.success : c.link} />}
                      </Pressable> : <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />}
                    </View>
                  ))}
                  {!dailyActivities.length && !activitiesLoading ? (
                    <View style={s.activitiesEmpty}>
                      <MaterialCommunityIcons
                        name="check-circle-outline"
                        size={27}
                        color={c.success}
                      />
                      <Text style={s.activitiesEmptyTitle}>
                        Nenhuma atividade pendente
                      </Text>
                      <Text style={s.activitiesEmptyText}>
                        Sua agenda está livre por enquanto.
                      </Text>
                    </View>
                  ) : null}
                </ScrollView>
              </View>
            </SafeAreaView>
          </View>
        </Modal>
        {healthOpen ? (
          <HealthTodayModal
            key={`${healthOpen}:${todayKey}`}
            kind={healthOpen}
            daily={activeRoutine.daily}
            date={todayKey}
            now={today}
            loading={activeRoutine.loading}
            error={activeRoutine.error}
            onClose={() => setHealthOpen(null)}
            onUpdated={activeRoutine.refresh}
            onManage={() => {
              const kind = healthOpen;
              setHealthOpen(null);
              router.push({ pathname: "/health-routine", params: { kind } });
            }}
          />
        ) : null}
        {injectablesOpen ? (
          <InjectablesTodayModal
            daily={injectables.daily}
            date={todayKey}
            loading={injectables.loading}
            error={injectables.error}
            onClose={() => setInjectablesOpen(false)}
            onUpdated={injectables.refresh}
            onManage={() => {
              setInjectablesOpen(false);
              router.push("/injectables");
            }}
          />
        ) : null}
        {goalOpen ? (
          <WorkoutGoalForm
            visible
            goal={goal}
            plans={plans}
            saving={goalSaving}
            error={goalError}
            onClose={() => setGoalOpen(false)}
            onSave={saveGoal}
          />
        ) : null}
        <QuickRegisterSheet
          visible={quickRegisterOpen}
          onClose={() => setQuickRegisterOpen(false)}
        />
        <Modal
          transparent
          visible={menuOpen}
          animationType="fade"
          onRequestClose={() => setMenuOpen(false)}
        >
          <View style={s.menuOverlay}>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar menu" style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} />
            <View accessibilityViewIsModal style={s.menuSheet}>
              <View style={s.menuTitleRow}>
                <Text accessibilityRole="header" style={s.menuTitle}>Menu</Text>
                <Pressable accessibilityRole="button"
                  accessibilityLabel="Fechar menu"
                  onPress={() => setMenuOpen(false)}
                  style={s.menuClose}
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={22}
                    color={c.textMuted}
                  />
                </Pressable>
              </View>
              <Pressable accessibilityRole="button"
                onPress={() => {
                  setMenuOpen(false);
                  router.push("/profile-details");
                }}
                style={s.menuItem}
              >
                <MaterialCommunityIcons
                  name="account-edit-outline"
                  size={21}
                  color={c.link}
                />
                <View style={s.flex}>
                  <Text style={s.menuItemTitle}>Editar perfil</Text>
                  <Text style={s.menuItemText}>Nome, @usuário e dados pessoais</Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color={c.textMuted}
                />
              </Pressable>
              {[
                { icon: "account-tie-outline" as IconName, title: "Meus profissionais", text: "Convites, permissões e planos recebidos", path: "/my-professionals" as const },
                { icon: "cog-outline" as IconName, title: "Configurações", text: "Tema e exibição da tela inicial", path: "/settings" as const },
                { icon: "message-alert-outline" as IconName, title: "Feedback, sugestões e bugs", text: "Conte como podemos melhorar", path: "/feedback" as const },
              ].map((item) => (
                <Pressable key={item.path} accessibilityRole="button" onPress={() => { setMenuOpen(false); router.push(item.path); }} style={s.menuItem}>
                  <MaterialCommunityIcons name={item.icon} size={21} color={c.link} />
                  <View style={s.flex}><Text style={s.menuItemTitle}>{item.title}</Text><Text style={s.menuItemText}>{item.text}</Text></View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />
                </Pressable>
              ))}
              <View style={s.menuDivider} />
              <Pressable accessibilityRole="button"
                onPress={async () => {
                  setMenuOpen(false);
                  if (await confirmAction({ title: "Sair da conta?", message: "Você precisará entrar novamente com e-mail e senha neste aparelho.", confirmLabel: "Sair da conta", cancelLabel: "Continuar conectado" })) void logout();
                }}
                style={s.menuItem}
              >
                <MaterialCommunityIcons
                  name="logout"
                  size={21}
                  color={c.danger}
                />
                <Text style={[s.menuItemTitle, { color: c.danger }]}>
                  Sair da conta
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (c: AppPalette, scheme: "light" | "dark") =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    safe: { flex: 1 },
    content: {
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 118,
      maxWidth: 720,
      width: "100%",
      alignSelf: "center",
      gap: 18,
    },
    flex: { flex: 1, minWidth: 0 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 2,
    },
    headerCopy: { flex: 1, gap: 2 },
    date: {
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0.7,
      textTransform: "uppercase",
      color: c.link,
    },
    greeting: {
      fontSize: 28,
      fontWeight: "800",
      letterSpacing: -0.8,
      color: c.text,
    },
    subtitle: { fontSize: 13, color: c.textMuted },
    menuButton: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: c.surfaceSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 20,
      backgroundColor: c.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { fontSize: 19, fontWeight: "800", color: c.link },
    menuOverlay: { flex: 1, backgroundColor: Scrim, justifyContent: "flex-end" },
    menuSheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 20,
      paddingBottom: 34,
      gap: 6,
    },
    menuTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingBottom: 8,
    },
    menuTitle: { fontSize: 20, fontWeight: "800", color: c.text },
    menuClose: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: c.surfaceSoft },
    menuItem: {
      minHeight: 66,
      flexDirection: "row",
      alignItems: "center",
      gap: 13,
      paddingHorizontal: 5,
    },
    menuItemTitle: { ...Type.body, fontWeight: "700", color: c.text },
    menuItemText: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    menuDivider: { height: 1, backgroundColor: c.border, marginVertical: 5 },
    hero: {
      backgroundColor: c.primaryStrong,
      // In dark mode the brand surface sits close to the page background; outline it.
      borderWidth: scheme === "dark" ? 1 : 0,
      borderColor: c.notificationBorder,
      borderRadius: 24,
      padding: 16,
      gap: 12,
      ...CardShadow,
    },
    heroTop: { flexDirection: "row", alignItems: "center", gap: 10 },
    heroIcon: {
      width: 38,
      height: 38,
      borderRadius: 16,
      backgroundColor: c.heroTint,
      alignItems: "center",
      justifyContent: "center",
    },
    heroEyebrow: { color: c.heroMuted, fontSize: 12, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
    heroTitle: {
      color: c.white,
      fontSize: 16,
      fontWeight: "800",
      marginTop: 1,
    },
    heroAdjust: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(255,255,255,.14)", alignItems: "center", justifyContent: "center" },
    heroProgress: { flexDirection: "row", alignItems: "center", gap: 10 },
    heroNumber: {
      fontSize: 27,
      fontWeight: "800",
      letterSpacing: -1,
      color: c.white,
    },
    heroTotal: { fontSize: 15, fontWeight: "700", color: c.heroMuted },
    heroCaption: { ...Type.label, color: c.onHero, fontWeight: "700" },
    heroNotice: { gap: 8 },
    heroInlineAction: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center", paddingHorizontal: 16, borderRadius: 12, backgroundColor: c.white },
    heroInlineActionText: { ...Type.label, fontWeight: "800", color: c.primaryStrong },
    heroHint: { ...Type.caption, color: c.heroMuted, marginTop: 2 },
    track: {
      height: 5,
      borderRadius: 8,
      backgroundColor: "rgba(255,255,255,.14)",
      overflow: "hidden",
    },
    fill: { height: "100%", borderRadius: 8, backgroundColor: c.secondary },
    week: { flexDirection: "row", justifyContent: "space-between", gap: 4 },
    day: {
      flex: 1,
      minWidth: 0,
      height: 46,
      borderRadius: 12,
      backgroundColor: "rgba(255,255,255,.08)",
      alignItems: "center",
      justifyContent: "center",
      gap: 1,
    },
    dayDone: { backgroundColor: c.secondary },
    dayPlanned: { borderWidth: 1, borderColor: "rgba(255,255,255,.62)" },
    dayText: { fontSize: 12, color: c.heroMuted, fontWeight: "700" },
    dayTextDone: { color: c.primaryStrong },
    dayStatus: { minHeight: 16, fontSize: 12, color: c.heroMuted, fontWeight: "700" },
    dayStatusDone: { color: c.primaryStrong },
    dayStatusPlanned: { color: c.white },
    fitnessActions: { flexDirection: "row", alignItems: "center", gap: 9 },
    heroButton: {
      height: 44,
      borderRadius: 16,
      backgroundColor: c.white,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: 15,
    },
    heroButtonText: { ...Type.label, fontWeight: "800", color: c.primaryStrong },
    fitnessLink: {
      flex: 1,
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 5,
    },
    fitnessLinkText: { ...Type.label, fontWeight: "700", color: c.heroMuted },
    sectionHeading: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 12,
      marginTop: 2,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: "800",
      letterSpacing: -0.4,
      color: c.text,
    },
    sectionSubtitle: { fontSize: 12, color: c.textMuted, marginTop: 3 },
    seeAll: { fontSize: 12, fontWeight: "800", color: c.link },
    routineCard: {
      backgroundColor: c.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 15,
    },
    routineRow: {
      minHeight: 82,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
    },
    rowDivider: { borderTopWidth: 1, borderTopColor: c.border },
    routineIcon: {
      width: 42,
      height: 42,
      borderRadius: 16,
      backgroundColor: c.surfaceSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    routineTitle: { fontSize: 15, fontWeight: "800", color: c.text },
    routineStatus: { fontSize: 12, color: c.textMuted, marginTop: 3 },
    routineLate: { color: c.warning, fontWeight: "700" },
    routineCount: { flexDirection: "row", alignItems: "baseline" },
    countStrong: { fontSize: 20, fontWeight: "800", color: c.text },
    countMuted: { fontSize: 13, fontWeight: "700", color: c.textMuted },
    addCircle: {
      width: 36,
      height: 36,
      borderRadius: 16,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    todayOverview: { flexDirection: "row", alignItems: "stretch", gap: 9 },
    todayCard: {
      flex: 1,
      minWidth: 0,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      padding: 12,
      gap: 8,
    },
    todayTop: { flexDirection: "row", alignItems: "center", gap: 8 },
    todayIcon: {
      width: 37,
      height: 37,
      borderRadius: 12,
      backgroundColor: c.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    todayLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", color: c.link },
    todayTitle: {
      fontSize: 13,
      fontWeight: "800",
      color: c.text,
      marginTop: 1,
    },
    todayTrack: {
      height: 5,
      borderRadius: 4,
      backgroundColor: c.surfaceSoft,
      overflow: "hidden",
    },
    todayFill: { height: "100%", borderRadius: 4, backgroundColor: c.success },
    todayNext: { fontSize: 12, color: c.textMuted },
    quickRegisterCompact: {
      width: 99,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      padding: 11,
      alignItems: "center",
      justifyContent: "center",
    },
    quickRegisterIcon: {
      width: 38,
      height: 38,
      borderRadius: 16,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 5,
    },
    quickRegisterTitle: { fontSize: 12, fontWeight: "800", color: c.text },
    quickRegisterText: { fontSize: 12, color: c.textMuted, marginTop: 1, textAlign: "center" },
    communityCard: {
      backgroundColor: c.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: c.border,
      padding: 15,
      gap: 12,
    },
    communityTop: { flexDirection: "row", alignItems: "center", gap: 11 },
    groupIcon: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: c.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    groupOptions: {
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: 10,
      gap: 4,
    },
    groupOption: {
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    groupOptionSelected: { backgroundColor: c.surfaceSoft },
    groupOptionText: {
      color: c.text,
      fontWeight: "700",
      fontSize: 13,
      flex: 1,
    },
    groupOptionCount: { color: c.link, fontWeight: "800", fontSize: 12 },
    communityAction: {
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: 13,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    communityActionText: { fontSize: 12, fontWeight: "800", color: c.link },
    socialUpdates: {
      backgroundColor: c.notificationBackground,
      borderWidth: 1, borderColor: c.notificationBorder,
      borderRadius: 16,
      padding: 13,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },
    socialUpdatesText: { ...Type.label, color: c.notificationText, fontWeight: "700", flex: 1 },
    disclaimer: { ...Type.caption, textAlign: "center", color: c.textMuted, paddingHorizontal: 12 },
    inlineRetry: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
    activitiesOverlay: { flex: 1, backgroundColor: Scrim, justifyContent: "flex-end" },
    activitiesSheet: {
      maxHeight: "82%",
      backgroundColor: c.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingBottom: 8,
    },
    sheetHandle: {
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      alignSelf: "center",
      marginTop: 9,
    },
    activitiesHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 18,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    activitiesTitle: { fontSize: 21, fontWeight: "800", color: c.text },
    activitiesSubtitle: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    activitiesClose: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: c.surfaceSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    activitiesList: { paddingHorizontal: 18, paddingBottom: 18 },
    activityRow: {
      minHeight: 70,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    activityIcon: {
      width: 42,
      height: 42,
      borderRadius: 16,
      backgroundColor: c.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    activityIconDone: { backgroundColor: c.success },
    activityTitle: { fontSize: 13, fontWeight: "800", color: c.text },
    activityTitleDone: {
      color: c.textMuted,
      textDecorationLine: "line-through",
    },
    activityDetail: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    activitiesEmpty: { padding: 25, alignItems: "center", gap: 6 },
    activitiesEmptyTitle: { fontSize: 15, fontWeight: "800", color: c.text },
    activitiesEmptyText: { fontSize: 12, color: c.textMuted },
  });
