import { showToast } from '@/components/app-dialog';
import { useWorkoutRun } from '@/components/workout-run-provider';
import { isWorkoutRunOpen } from '@fit/contracts';
import Constants from 'expo-constants';
import {useGroupUpdates} from '@/components/group-updates-provider';
import {GroupUpdatesBadge} from '@/components/group-updates-badge';
import { HomeNutrition } from '@/components/home-nutrition';
import { useAppTheme } from "@/theme/theme-provider";
import { Scrim, Type, type AppPalette } from "@/constants/theme";
import { SceneBackdrop } from "@/components/scene";
import MaterialCommunityIcons from '@/components/icon';
import type {
  GroupSummary,
  HealthKind,
  WorkoutGoalInput,
  WorkoutGoalSummary,
  WorkoutPlan,
} from "@fit/contracts";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
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
import { HomeShortcuts } from "@/components/home-shortcuts";
import { useInjectablesToday } from "@/hooks/use-injectables-today";
import { InjectablesTodayModal } from "@/components/injectables-today-modal";
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
  /** Scheduled time, used to group doses taken together ("08:00 · 10 itens"). */
  time?: string;
  /** Records the dose without refreshing, so a whole time slot is saved before one refresh. */
  markDone?(): Promise<unknown>;
  /** Skipped for today: kept visible for undo, left out of the progress count. */
  dismissed?: boolean;
  setDismissed?(dismissed: boolean): Promise<void>;
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
  const { showChecks } = useLocalSearchParams<{ showChecks?: string }>();
  const { colors: c, scheme } = useAppTheme();
  const s = createStyles(c, scheme);
  const { run: workoutRun } = useWorkoutRun();
  const openRun = workoutRun && isWorkoutRunOpen(workoutRun.progress) ? workoutRun : null;
  const { showEnergyBalance, showShortcuts } = useHomePreferences();

  const { user, api, logout } = useAuth();
  const [nutritionRevision, setNutritionRevision] = useState(0);
  const [goal, setGoal] = useState<WorkoutGoalSummary | null>(null);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalError, setGoalError] = useState("");
  const [healthOpen, setHealthOpen] = useState<HealthKind | null>(null);
  const [injectablesOpen, setInjectablesOpen] = useState(false);
  const [professionalUnread, setProfessionalUnread] = useState(0);
  const [notificationError, setNotificationError] = useState(false);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const groupDashboard=useGroupUpdates();
  const postsUnseen=groupDashboard.postsUnseen??0;
  const [activeGroupId, setActiveGroupId] = useState("");
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activitiesOpen, setActivitiesOpenState] = useState(false);
  const setActivitiesOpen = (open: boolean) => {
    setActivitiesOpenState(open);
    if (!open && showChecks === '1') router.setParams({ showChecks: undefined });
  };
  const actionLock = useRef(false);
  const [dismissedOpen, setDismissedOpen] = useState(false);
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
  useFocusEffect(useCallback(() => {
    let active = true;
    const refresh = () => api.listProfessionalNotifications().then(result => { if (active) { setProfessionalUnread(result.unreadCount); setNotificationError(false); } }).catch(() => { if (active) setNotificationError(true); });
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 60000);
    return () => { active = false; clearInterval(timer); };
  }, [api]));
  const refreshGroups = useCallback(async () => {
    try {
      const items = await api.listGroups();
      setGroups(items);
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
  // No group yet (and nothing loading or failing): the card becomes an illustrated invitation.
  const inviteGroup = !activeGroup && groupsState !== "loading" && groupsState !== "error";
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
  const dailyActivities: DailyActivity[] = [
    ...(medications.daily?.items.map((entry) => ({
      id: `medication:${entry.item.id}:${entry.slot}`,
      title: entry.item.name,
      detail: `Medicamento${entry.time ? ` · ${entry.time}` : ""}`,
      icon: "pill" as IconName,
      done: Boolean(entry.consumedAt),
      time: entry.time ?? undefined,
      markDone: () => api.setHealthIntake('medication', entry.item.id, todayKey, entry.slot, true),
      dismissed: Boolean(entry.dismissedAt),
      setDismissed: async (dismissed: boolean) => { await api.setHealthDismissal('medication', entry.item.id, todayKey, entry.slot, dismissed); if (!await medications.refresh()) throw new Error('refresh'); },
      open: () => setHealthOpen("medication"),
      toggle: async () => { await api.setHealthIntake('medication', entry.item.id, todayKey, entry.slot, !entry.consumedAt); if (!await medications.refresh()) throw new Error('refresh'); },
    })) ?? []),
    ...(supplements.daily?.items.map((entry) => ({
      id: `supplement:${entry.item.id}:${entry.slot}`,
      title: entry.item.name,
      detail: `Suplemento${entry.time ? ` · ${entry.time}` : ""}`,
      icon: "bottle-tonic-outline" as IconName,
      done: Boolean(entry.consumedAt),
      time: entry.time ?? undefined,
      markDone: () => api.setHealthIntake('supplement', entry.item.id, todayKey, entry.slot, true),
      dismissed: Boolean(entry.dismissedAt),
      setDismissed: async (dismissed: boolean) => { await api.setHealthDismissal('supplement', entry.item.id, todayKey, entry.slot, dismissed); if (!await supplements.refresh()) throw new Error('refresh'); },
      open: () => setHealthOpen("supplement"),
      toggle: async () => { await api.setHealthIntake('supplement', entry.item.id, todayKey, entry.slot, !entry.consumedAt); if (!await supplements.refresh()) throw new Error('refresh'); },
    })) ?? []),
    ...(injectables.daily?.items.map((entry) => ({
      id: `injectable:${entry.injectable.id}`,
      title: entry.injectable.name,
      detail: "Aplicação prevista",
      icon: "needle" as IconName,
      done: Boolean(entry.application),
      dismissed: Boolean(entry.dismissedAt),
      setDismissed: async (dismissed: boolean) => { await api.setInjectableDismissal(entry.injectable.id, todayKey, dismissed); if (!await injectables.refresh()) throw new Error('refresh'); },
      open: () => setInjectablesOpen(true),
    })) ?? []),
    ...(user?.countMentalCheckIn !== false ? [{
      id: "mental-check-in",
      title: "Como você está se sentindo?",
      detail: mentalDone === "error" ? "Não foi possível verificar agora" : "Check-in da Mente",
      icon: "head-heart-outline" as IconName,
      done: mentalDone === true,
      open: () => router.push("/mental-wellbeing"),
    }] : []),

  ];
  const toggleActivity = async (activity: DailyActivity) => {
    if (actionLock.current || !activity.toggle) return;
    if (localDay() !== todayKey) { setActivityError('O dia mudou. Aguarde a atualização antes de registrar.'); return; }
    actionLock.current = true; setActivityBusy(activity.id); setActivityError('');
    try { await activity.toggle(); }
    catch { setActivityError('Não foi possível confirmar a alteração. Atualize a rotina antes de tentar novamente.'); await Promise.all([medications.refresh(), supplements.refresh()]); }
    finally { actionLock.current = false; setActivityBusy(''); }
  };
  const dismissActivity = async (activity: DailyActivity, dismissed: boolean) => {
    if (actionLock.current || !activity.setDismissed) return;
    if (localDay() !== todayKey) { setActivityError('O dia mudou. Aguarde a atualização antes de registrar.'); return; }
    actionLock.current = true; setActivityBusy(`dismiss:${activity.id}`); setActivityError('');
    try { await activity.setDismissed(dismissed); showToast(dismissed ? `${activity.title} dispensado hoje. Desfaça em “Dispensadas hoje”.` : `${activity.title} voltou para a rotina de hoje.`); }
    catch { setActivityError('Não foi possível atualizar a atividade. Confira a lista e tente novamente.'); await Promise.all([medications.refresh(), supplements.refresh(), injectables.refresh()]); }
    finally { actionLock.current = false; setActivityBusy(''); }
  };
  const markGroup = async (key: string, items: DailyActivity[]) => {
    const pending = items.filter(item => !item.done && item.markDone);
    if (actionLock.current || !pending.length) return;
    if (localDay() !== todayKey) { setActivityError('O dia mudou. Aguarde a atualização antes de registrar.'); return; }
    actionLock.current = true; setActivityBusy(`group:${key}`); setActivityError('');
    try { for (const item of pending) await item.markDone!(); showToast(`${pending.length} ${pending.length === 1 ? 'dose registrada' : 'doses registradas'}. Toque em uma para desfazer.`); }
    catch { setActivityError('Nem todas as doses foram registradas. Confira a lista e tente novamente.'); }
    finally { await Promise.all([medications.refresh(), supplements.refresh()]); actionLock.current = false; setActivityBusy(''); }
  };
  const dismissedActivities = dailyActivities.filter(item => item.dismissed);
  const routineActivities = dailyActivities.filter(item => !item.dismissed);
  // Doses with the same time are taken together: group them so a slot can be checked at once.
  // Untimed doses ("a qualquer hora") can also be checked together; injectables/check-in stay apart.
  const groupOrder = (key: string) => key === 'anytime' ? '99:98' : key === 'other' ? '99:99' : key;
  const activityGroups = routineActivities.reduce<{ key: string; time?: string; items: DailyActivity[] }[]>((groups, activity) => {
    const key = activity.markDone ? activity.time ?? 'anytime' : 'other';
    const group = groups.find(item => item.key === key);
    if (group) group.items.push(activity); else groups.push({ key, time: key === 'other' || key === 'anytime' ? undefined : key, items: [activity] });
    return groups;
  }, []).sort((a, b) => groupOrder(a.key).localeCompare(groupOrder(b.key)));
  const groupTitle = (group: { key: string; time?: string; items: DailyActivity[] }) => group.key === 'anytime' ? `A qualquer hora · ${group.items.length} ${group.items.length === 1 ? 'item' : 'itens'}` : group.time ? `${group.time} · ${group.items.length} ${group.items.length === 1 ? 'item' : 'itens'}` : 'Outras';
  const completedActivities = routineActivities.filter(
    (item) => item.done,
  ).length;
  const activitiesLoading =
    medications.loading ||
    supplements.loading ||
    injectables.loading ||
    (user?.countMentalCheckIn !== false && mentalDone === null);
  const nextActivity = routineActivities.find((item) => !item.done);
  const remainingActivities = routineActivities.length - completedActivities;
  const activityProgress = routineActivities.length
    ? completedActivities / routineActivities.length
    : 0;
  const openDailyActivity = (activity: DailyActivity) => {
    setActivitiesOpen(false);
    activity.open();
  };

  return (
    <View style={s.root}>
      <SafeAreaView style={s.safe} edges={["top"]}>
        <ScrollView
          testID="home-scroll"
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Two tiers: on narrow phones avatar + actions on one row left ~150px for the greeting. */}
          <View style={s.header}>
            <View style={s.headerTop}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Abrir menu"
                accessibilityHint="Perfil, profissionais, configurações e sair da conta"
                onPress={() => setMenuOpen(true)}
                style={s.avatar}
              >
                {user?.avatarUrl?<Image source={{uri:user.avatarUrl}} style={{width:48,height:48,borderRadius: 20}}/>:<Text style={s.avatarText}>
                  {firstName[0].toLocaleUpperCase("pt-BR")}
                </Text>}
              </Pressable>
              <View style={s.headerActions}>
                <Pressable accessibilityRole="button" accessibilityLabel={postsUnseen > 0 ? `Social, ${postsUnseen} ${postsUnseen === 1 ? 'post não lido' : 'posts não lidos'}` : 'Social'} onPress={() => router.push('/groups')} style={s.menuButton}>
                  <MaterialCommunityIcons name="account-group-outline" size={25} color={c.link}/>
                  <GroupUpdatesBadge count={postsUnseen} focused={false}/>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Notificações, ${professionalUnread + groupDashboard.notificationsUnread} não lidas${notificationError ? ', atualização indisponível' : ''}`} onPress={() => router.push('/group-notifications')} style={s.menuButton}>
                  <MaterialCommunityIcons name="bell-outline" size={25} color={c.link}/>
                  <GroupUpdatesBadge count={professionalUnread + groupDashboard.notificationsUnread} focused={false} stale={notificationError}/>
                </Pressable>
              </View>
            </View>
            <View style={s.headerCopy}>
              <Text style={s.date}>{formattedDate}</Text>
              <Text accessibilityRole="header" style={s.greeting}>
                Olá, {firstName}
              </Text>
              <Text style={s.subtitle}>Vamos cuidar da sua rotina hoje?</Text>
            </View>
          </View>

          <View style={s.todayOverview}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ver rotina de hoje, ${completedActivities} de ${routineActivities.length} feitas`}
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
                  <Text style={s.todayLabel}>Rotina de hoje</Text>
                  <Text style={s.todayTitle}>
                    {activitiesLoading
                      ? "Atualizando…"
                      : !routineActivities.length
                        ? "Nada programado"
                        : remainingActivities
                          ? `${remainingActivities} ${remainingActivities === 1 ? "restante" : "restantes"}`
                          : "Tudo feito hoje"}
                  </Text>
                </View>
                {!activitiesLoading && routineActivities.length ? (
                  <Text style={s.todayCount}>{completedActivities}/{routineActivities.length}</Text>
                ) : null}
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
          </View>

          <View style={s.hero}>
            <SceneBackdrop scene="pulseTall" />
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
                const isToday = date === todayKey;
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
                      isToday ? `${day.full}, hoje` : day.full,
                      division ? `treino ${division.label} planejado: ${division.name}` : scheduled ? "treino planejado" : "",
                      doneLabel || (scheduled ? "ainda não realizado" : "sem treino"),
                    ].filter(Boolean).join(", ")}
                    style={[
                      s.day,
                      sessions > 0 && s.dayDone,
                      scheduled && sessions === 0 && s.dayPlanned,
                      isToday && s.dayToday,
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
                onPress={() => router.push(openRun || hasPlans || !goal ? "/workout-run" : "/workout-create")}
                style={s.heroButton}
              >
                <MaterialCommunityIcons
                  name={openRun || hasPlans || !goal ? "play" : "plus"}
                  size={18}
                  color={c.primaryStrong}
                />
                <Text style={s.heroButtonText}>{openRun ? `Continuar treino ${openRun.divisionLabel}` : hasPlans || !goal ? "Iniciar treino" : "Criar ficha"}</Text>
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
          {showShortcuts ? <HomeShortcuts /> : null}

          <View style={s.sectionHeading}>
            <View>
              <Text style={s.sectionTitle}>Sua comunidade</Text>
              <Text style={s.sectionSubtitle}>
                Treinar junto ajuda a manter o ritmo
              </Text>
            </View>
          </View>
          <View style={[s.communityCard, inviteGroup && s.communityInvite, CardShadow]}>
            {inviteGroup ? <SceneBackdrop scene="groups" /> : null}
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
                <View style={s.inviteCopy}>
                  <Text style={[s.routineTitle, s.inviteTitle]}>Crie seu primeiro grupo</Text>
                  <Text style={[s.routineStatus, s.inviteText]}>
                    Compartilhe conquistas com pessoas de confiança
                  </Text>
                </View>
                <View style={s.flex} />
                <MaterialCommunityIcons
                  name="arrow-right"
                  size={20}
                  color={c.onHero}
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
          visible={activitiesOpen || showChecks === '1'}
          animationType="slide"
          onRequestClose={() => setActivitiesOpen(false)}
        >
          <View style={s.activitiesOverlay}>
            {/* Backdrop is a sibling, not a parent, so sheet controls are never nested buttons. */}
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar atividades" style={StyleSheet.absoluteFill} onPress={() => setActivitiesOpen(false)} />
            <SafeAreaView style={s.activitiesSheet} edges={["bottom"]}>
              <View style={s.shrink}>
                <View style={s.sheetHandle} />
                <View style={s.activitiesHeader}>
                  <View style={s.flex}>
                    <Text style={s.activitiesTitle}>Rotina de hoje</Text>
                    <Text style={s.activitiesSubtitle}>
                      {activitiesLoading
                        ? "Atualizando sua rotina…"
                        : `${completedActivities}/${routineActivities.length} ${routineActivities.length === 1 ? "concluída" : "concluídas"}${dismissedActivities.length ? ` · ${dismissedActivities.length} ${dismissedActivities.length === 1 ? "dispensada" : "dispensadas"}` : ""}`}
                    </Text>
                  </View>
                  <Pressable accessibilityRole="button"
                    accessibilityLabel="Fechar rotina de hoje"
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
                <ScrollView style={s.shrink} contentContainerStyle={s.activitiesList}>
                  {activityError ? <Text accessibilityRole="alert" style={{ color: c.danger, paddingVertical: 12 }}>{activityError}</Text> : null}
                  {medications.error || supplements.error ? <Text accessibilityRole="alert" style={{ color: c.danger }}>{medications.error || supplements.error}</Text> : null}
                  {activityGroups.map(group => <View key={group.key}>
                    {activityGroups.length > 1 || group.key !== 'other' ? <View style={s.activityGroupHeader}><Text style={s.activityGroupTitle}>{groupTitle(group)}</Text>{group.key !== 'other' && group.items.filter(item => !item.done).length > 1 ? <Pressable accessibilityRole="button" accessibilityLabel={group.time ? `Marcar todas as doses das ${group.time}` : 'Marcar todas as doses sem horário'} disabled={Boolean(activityBusy) || Boolean(medications.error || supplements.error)} onPress={() => void markGroup(group.key, group.items)} style={s.activityGroupAction}>{activityBusy === `group:${group.key}` ? <ActivityIndicator color={c.link}/> : <Text style={s.activityGroupActionText}>Marcar todos</Text>}</Pressable> : null}</View> : null}
                  {group.items.map((activity) => (
                    <View key={activity.id} style={s.activityRow}>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Ver ${activity.title}`} onPress={() => openDailyActivity(activity)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 60 }}>
                        <View style={[s.activityIcon, activity.done && s.activityIconDone]}><MaterialCommunityIcons name={activity.done ? 'check' : activity.icon} size={20} color={activity.done ? c.background : c.link} /></View>
                        <View style={s.flex}><Text style={[s.activityTitle, activity.done && s.activityTitleDone]}>{activity.title}</Text><Text style={s.activityDetail}>{activity.done ? 'Concluído' : activity.detail}</Text></View>
                      </Pressable>
                      {!activity.done && activity.setDismissed ? <Pressable accessibilityRole="button" accessibilityLabel={`Dispensar ${activity.title} hoje`} disabled={Boolean(activityBusy)} onPress={() => void dismissActivity(activity, true)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                        {activityBusy === `dismiss:${activity.id}` ? <ActivityIndicator color={c.textMuted} /> : <MaterialCommunityIcons name="calendar-remove-outline" size={22} color={c.textMuted} />}
                      </Pressable> : null}
                      {activity.toggle ? <Pressable accessibilityRole="checkbox" aria-checked={activity.done} accessibilityLabel={`${activity.done ? 'Desfazer tomada de' : 'Registrar tomada de'} ${activity.title}`} aria-disabled={Boolean(activityBusy)} disabled={Boolean(activityBusy) || Boolean(medications.error || supplements.error)} onPress={() => void toggleActivity(activity)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                        {activityBusy === activity.id ? <ActivityIndicator color={c.link} /> : <MaterialCommunityIcons name={activity.done ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} size={28} color={activity.done ? c.success : c.link} />}
                      </Pressable> : <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />}
                    </View>
                  ))}
                  </View>)}
                  {dismissedActivities.length ? <DismissedActivities items={dismissedActivities} open={dismissedOpen} busy={activityBusy} styles={s} onToggle={() => setDismissedOpen(open => !open)} onRestore={activity => void dismissActivity(activity, false)} /> : null}
                  {!dailyActivities.length && !activitiesLoading ? (
                    <View style={s.activitiesEmpty}>
                      <MaterialCommunityIcons
                        name="check-circle-outline"
                        size={27}
                        color={c.success}
                      />
                      <Text style={s.activitiesEmptyTitle}>
                        Nada programado para hoje
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
                  await logout();
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
              <Text style={s.menuVersion}>Versão {String(Constants.expoConfig?.extra?.releaseName ?? Constants.expoConfig?.version ?? '—')}</Text>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}


/** Skipped items stay reachable for undo without counting toward today's progress. */
function DismissedActivities({ items, open, busy, styles: s, onToggle, onRestore }: { items: DailyActivity[]; open: boolean; busy: string; styles: ReturnType<typeof createStyles>; onToggle(): void; onRestore(activity: DailyActivity): void }) {
  const { colors: c } = useAppTheme();
  return <View>
    <Pressable accessibilityRole="button" aria-expanded={open} onPress={onToggle} style={s.activityGroupHeader}>
      <Text style={s.activityGroupTitle}>Dispensadas hoje · {items.length}</Text>
      <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={c.textMuted} />
    </Pressable>
    {open ? items.map(activity => <View key={activity.id} style={s.activityRow}>
      <View style={[s.activityIcon, { opacity: 0.5 }]}><MaterialCommunityIcons name={activity.icon} size={20} color={c.textMuted} /></View>
      <View style={s.flex}><Text style={[s.activityTitle, s.activityTitleDone]}>{activity.title}</Text><Text style={s.activityDetail}>Dispensada · {activity.detail}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Desfazer dispensa de ${activity.title}`} disabled={Boolean(busy)} onPress={() => onRestore(activity)} style={s.activityGroupAction}>
        {busy === `dismiss:${activity.id}` ? <ActivityIndicator color={c.link} /> : <Text style={s.activityGroupActionText}>Desfazer</Text>}
      </Pressable>
    </View>) : null}
  </View>;
}

const createStyles = (c: AppPalette, scheme: "light" | "dark") =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    safe: { flex: 1 },
    content: {
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 24,
      maxWidth: 720,
      width: "100%",
      alignSelf: "center",
      gap: 18,
    },
    flex: { flex: 1, minWidth: 0 },
    header: { gap: 14, marginBottom: 2 },
    headerTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerActions: { flexDirection: "row", gap: 10 },
    headerCopy: { gap: 4 },
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
    subtitle: { fontSize: 14, color: c.textMuted },
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
    menuVersion: { fontSize: 11, color: c.textMuted, textAlign: "center", marginTop: 8, marginBottom: 4 },
    menuItemText: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    menuDivider: { height: 1, backgroundColor: c.border, marginVertical: 5 },
    hero: {
      backgroundColor: c.primaryStrong,
      // In dark mode the brand surface sits close to the page background; outline it.
      borderWidth: scheme === "dark" ? 1 : 0,
      borderColor: c.notificationBorder,
      borderRadius: 24,
      overflow: "hidden",
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
    dayToday: { borderWidth: 2, borderColor: c.white },
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
    communityCard: {
      backgroundColor: c.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: c.border,
      padding: 15,
      gap: 12,
    },
    communityTop: { flexDirection: "row", alignItems: "center", gap: 11 },
    communityInvite: { backgroundColor: c.primaryStrong, borderWidth: 0, overflow: "hidden", minHeight: 112, justifyContent: "center" },
    inviteCopy: { maxWidth: "62%" },
    inviteTitle: { color: c.onHero },
    inviteText: { color: c.heroMuted },
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
    // Sem encolher, a lista ultrapassa o maxHeight da folha e o último item fica fora da tela.
    shrink: { flexShrink: 1 },
    activitiesList: { paddingHorizontal: 18, paddingBottom: 18 },
    todayCount: { fontSize: 20, fontWeight: '800', color: c.link, fontVariant: ['tabular-nums'] },
    activityGroupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 12, paddingBottom: 4 },
    activityGroupTitle: { fontSize: 12, fontWeight: '800', letterSpacing: .4, color: c.textMuted, textTransform: 'uppercase' },
    activityGroupAction: { minHeight: 44, paddingHorizontal: 12, borderRadius: 12, justifyContent: 'center', backgroundColor: c.primarySoft },
    activityGroupActionText: { fontSize: 13, fontWeight: '800', color: c.link },
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
