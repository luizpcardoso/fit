import { RELEASE_VERSION } from '@/constants/release-version';
import { InjectableIllustration } from '@/components/injectable-illustration';
import { HealthIllustration } from '@/components/health-illustration';
import { showToast } from '@/components/app-dialog';
import { useWorkoutRun } from '@/components/workout-run-provider';
import { isWorkoutRunOpen } from '@fit/contracts';
import {useGroupUpdates} from '@/components/group-updates-provider';
import {GroupUpdatesBadge} from '@/components/group-updates-badge';
import { HomeAccompanimentCard } from '@/components/home-accompaniment-card';
import { HomeNutrition } from '@/components/home-nutrition';
import { useAppTheme } from "@/theme/theme-provider";
import { Scrim, Type, type AppPalette } from "@/constants/theme";
import { SceneThumb, type SceneName } from "@/components/scene";
import MaterialCommunityIcons from '@/components/icon';
import type {
  HealthKind,
  HealthItem,
  Injectable,
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
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
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
import { HomeCommunity } from "@/components/home-community";
import { useInjectablesToday } from "@/hooks/use-injectables-today";
import { InjectablesTodayModal } from "@/components/injectables-today-modal";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type DailyActivity = {
  id: string;
  title: string;
  detail: string;
  icon: IconName;
  injectableItem?: Injectable;
  healthItem?: HealthItem;
  healthKind?: HealthKind;
  scene?: SceneName;
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
  /** Its state could not be read: listed, but never counted as pending or done. */
  unverified?: boolean;
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
  const { colors: c } = useAppTheme();
  const s = createStyles(c);
  // Tablets and desktop web get a wider column so the three panels fit side by side.
  const wide = useWindowDimensions().width >= 1000;
  const { run: workoutRun } = useWorkoutRun();
  const openRun = workoutRun && isWorkoutRunOpen(workoutRun.progress) ? workoutRun : null;

  const { user, api, logout } = useAuth();
  const [goal, setGoal] = useState<WorkoutGoalSummary | null>(null);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalError, setGoalError] = useState("");
  // Kept apart from the load error so a failed refresh never shows up inside the goal form.
  const [goalSaveError, setGoalSaveError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [healthOpen, setHealthOpen] = useState<HealthKind | null>(null);
  const [injectablesOpen, setInjectablesOpen] = useState(false);
  const [professionalUnread, setProfessionalUnread] = useState(0);
  const [notificationError, setNotificationError] = useState(false);
  const groupDashboard=useGroupUpdates();
  const postsUnseen=groupDashboard.postsUnseen??0;
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
  const refreshNotifications = useCallback(async () => {
    try { setProfessionalUnread((await api.listProfessionalNotifications()).unreadCount); setNotificationError(false); }
    catch { setNotificationError(true); }
  }, [api]);
  useFocusEffect(useCallback(() => {
    void refreshNotifications();
    const timer = setInterval(() => { void refreshNotifications(); }, 60000);
    return () => clearInterval(timer);
  }, [refreshNotifications]));
  const supplements = useHealthRoutine("supplement", todayKey);
  const medications = useHealthRoutine("medication", todayKey);
  const injectables = useInjectablesToday(todayKey);
  const activeRoutine = healthOpen === "medication" ? medications : supplements;
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
  const openGoalForm = () => { setGoalSaveError(""); setGoalOpen(true); };
  const saveGoal = async (input: WorkoutGoalInput) => {
    setGoalSaving(true);
    setGoalSaveError("");
    try {
      await api.updateWorkoutGoal(input);
      await refreshGoal();
      setGoalOpen(false);
    } catch (error) {
      setGoalSaveError(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar sua meta.",
      );
    } finally {
      setGoalSaving(false);
    }
  };
  // Plans load together with the goal: until then, starting or creating a workout is a guess.
  const workoutUnknown = !goal && !openRun;
  const todaySessions = goal?.sessionsByDate[todayKey] ?? 0;
  const nextPlanned = goalConfigured && !openRun ? goal?.nextPlanned ?? null : null;
  const plannedToday = nextPlanned?.date === todayKey && !todaySessions ? nextPlanned : null;
  const plannedName = (item: NonNullable<typeof nextPlanned>) => `${item.divisionLabel ? `Treino ${item.divisionLabel}` : "Treino planejado"}${item.divisionName ? ` · ${item.divisionName}` : ""}`;
  const missedDates = new Set(goal?.missedPlanned.map((item) => item.date) ?? []);
  const dailyActivities: DailyActivity[] = [
    ...(medications.daily?.items.map((entry) => ({
      id: `medication:${entry.item.id}:${entry.slot}`,
      title: entry.item.name,
      healthItem: entry.item,
      detail: `Medicamento${entry.time ? ` · ${entry.time}` : ""}`,
      icon: "pill" as IconName,
      healthKind: 'medication' as const,
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
      healthItem: entry.item,
      detail: `Suplemento${entry.time ? ` · ${entry.time}` : ""}`,
      icon: "bottle-tonic-outline" as IconName,
      healthKind: 'supplement' as const,
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
      injectableItem: entry.injectable,
      detail: "Aplicação prevista",
      icon: "needle" as IconName,
      scene: 'thumbInjectable' as const,
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
      scene: 'thumbMind' as const,
      done: mentalDone === true,
      unverified: mentalDone === "error",
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
  const occasionalCount = (medications.occasional?.count ?? 0) + (supplements.occasional?.count ?? 0);
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
  const countedActivities = routineActivities.filter((item) => !item.unverified);
  const completedActivities = countedActivities.filter(
    (item) => item.done,
  ).length;
  const activitiesLoading =
    medications.loading ||
    supplements.loading ||
    injectables.loading ||
    (user?.countMentalCheckIn !== false && mentalDone === null);
  // Earliest scheduled dose first, so an overdue one is never hidden behind a later item.
  const nextActivity = countedActivities
    .filter((item) => !item.done)
    .sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"))[0];
  const nowTime = `${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`;
  const nextLate = Boolean(nextActivity?.time && nextActivity.time < nowTime);
  const remainingActivities = countedActivities.length - completedActivities;
  const activityProgress = countedActivities.length
    ? completedActivities / countedActivities.length
    : 0;
  const routineSources = [medications, supplements, injectables];
  const routineErrorText = medications.error || supplements.error || injectables.error || (mentalDone === "error" ? "Não foi possível verificar seu check-in da Mente." : "");
  // A failed load is never presented as an empty or untouched day.
  const routineUnavailable = !activitiesLoading && !countedActivities.length && routineSources.some((source) => source.error && !source.daily);
  const routinePartial = !activitiesLoading && Boolean(routineErrorText) && !routineUnavailable;
  const retryRoutine = () => { void Promise.all([medications.refresh(), supplements.refresh(), injectables.refresh(), refreshMental()]); };
  const refreshAll = async () => {
    setRefreshing(true);
    setRefreshSignal((value) => value + 1);
    await Promise.allSettled([refreshGoal(), refreshMental(), refreshNotifications(), medications.refresh(), supplements.refresh(), injectables.refresh()]);
    setRefreshing(false);
  };
  const unreadNotifications = professionalUnread + groupDashboard.notificationsUnread;
  const openDailyActivity = (activity: DailyActivity) => {
    setActivitiesOpen(false);
    activity.open();
  };

  return (
    <View style={s.root}>
      <SafeAreaView style={s.safe} edges={["top"]}>
        <ScrollView
          testID="home-scroll"
          contentContainerStyle={[s.content, wide && s.contentWide]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refreshAll()} tintColor={c.link} colors={[c.link]} />}
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
                <Pressable accessibilityRole="button" accessibilityLabel={postsUnseen > 0 ? `Comunidade, ${postsUnseen} ${postsUnseen === 1 ? 'post não lido' : 'posts não lidos'}` : 'Comunidade'} onPress={() => router.push('/groups')} style={[s.menuButton, s.communityHeaderButton]}>
                  <Text style={s.communityHeaderLabel}>Comunidade</Text>
                  <MaterialCommunityIcons name="account-group-outline" size={25} color={c.link}/>
                  <GroupUpdatesBadge count={postsUnseen} focused={false}/>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Notificações, ${unreadNotifications === 0 ? 'nenhuma não lida' : unreadNotifications === 1 ? '1 não lida' : `${unreadNotifications} não lidas`}${notificationError ? ', atualização indisponível' : ''}`} onPress={() => router.push('/group-notifications')} style={s.menuButton}>
                  <MaterialCommunityIcons name="bell-outline" size={25} color={c.link}/>
                  <GroupUpdatesBadge count={unreadNotifications} focused={false} stale={notificationError}/>
                </Pressable>
              </View>
            </View>
            <View style={s.headerCopy}>
              <Text style={s.date}>{formattedDate}</Text>
              <Text accessibilityRole="header" style={s.greeting}>
                Olá, {firstName}
              </Text>
            </View>
          </View>

          <View style={s.todayOverview}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={activitiesLoading
                ? "Rotina de hoje, atualizando"
                : routineUnavailable
                  ? "Rotina de hoje indisponível. Tentar novamente"
                  : `Ver rotina de hoje, ${completedActivities} de ${countedActivities.length} feitas${routinePartial ? ", atualização incompleta" : ""}`}
              onPress={() => routineUnavailable ? retryRoutine() : setActivitiesOpen(true)}
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
                  <Text numberOfLines={1} style={[s.todayTitle, nextLate && !activitiesLoading && s.todayTitleLate]}>
                    {activitiesLoading
                      ? "Atualizando…"
                      : routineUnavailable
                        ? "Não foi possível atualizar"
                        : !countedActivities.length
                          ? "Nada programado"
                          : nextActivity
                            ? `${nextLate ? "Atrasada" : "Próxima"}: ${nextActivity.time ? `${nextActivity.time} · ` : ""}${nextActivity.title}`
                            : "Tudo feito hoje"}
                  </Text>
                </View>
                {!activitiesLoading && countedActivities.length ? (
                  <Text style={s.todayCount}>{completedActivities}/{countedActivities.length}</Text>
                ) : null}
                <MaterialCommunityIcons
                  name={routineUnavailable ? "refresh" : "chevron-right"}
                  size={20}
                  color={c.textMuted}
                />
              </View>
              {occasionalCount ? <Text style={s.todayNext}>{occasionalCount} {occasionalCount === 1 ? 'tomada eventual' : 'tomadas eventuais'}</Text> : null}
              <View style={s.todayTrack}>
                <View
                  style={[s.todayFill, { width: `${activityProgress * 100}%` }]}
                />
              </View>
              <Text numberOfLines={1} style={[s.todayNext, (routineUnavailable || routinePartial) && s.todayNextError]}>
                {activitiesLoading
                  ? "Buscando sua rotina do dia"
                  : routineUnavailable
                    ? "Toque para tentar novamente"
                    : routinePartial
                      ? "Parte da rotina não foi atualizada"
                      : remainingActivities
                        ? `${remainingActivities} ${remainingActivities === 1 ? "restante" : "restantes"}`
                        : !countedActivities.length ? "Suas atividades programadas aparecem aqui" : "Tudo concluído por hoje ✓"}
              </Text>
            </Pressable>
          </View>

          <HomeNutrition date={todayKey} refreshSignal={refreshSignal} workout={<HomeAccompanimentCard topic="workout" title="Seu treino" icon="dumbbell" testID="home-workout-card" action={
            <Pressable accessibilityRole="button" accessibilityLabel={goalConfigured ? "Ajustar meta semanal" : "Definir meta semanal"} onPress={openGoalForm} style={s.heroAdjust}>
              <MaterialCommunityIcons name="tune-variant" size={20} color={c.link}/>
            </Pressable>
          }>
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
                <Pressable accessibilityRole="button" onPress={openGoalForm} style={s.heroInlineAction}>
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
                const missed = sessions === 0 && missedDates.has(date);
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
                      doneLabel || (missed ? "não realizado" : scheduled ? "ainda não realizado" : "sem treino"),
                    ].filter(Boolean).join(", ")}
                    style={[
                      s.day,
                      sessions > 0 && s.dayDone,
                      scheduled && sessions === 0 && s.dayPlanned,
                      missed && s.dayMissed,
                      isToday && s.dayToday,
                    ]}
                  >
                    <Text maxFontSizeMultiplier={1.2} style={[s.dayText, sessions > 0 && s.dayTextDone]}>
                      {day.short}
                    </Text>
                    <Text
                      maxFontSizeMultiplier={1.2}
                      style={[
                        s.dayStatus,
                        sessions > 0 && s.dayStatusDone,
                        planLabel && sessions === 0 && s.dayStatusPlanned,
                        missed && s.dayStatusMissed,
                      ]}
                    >
                      {status}
                    </Text>
                  </View>
                );
              })}
            </View>
            {nextPlanned ? (
              <Text style={s.heroPlanned}>
                {plannedToday ? "Hoje: " : `Próximo, ${weekdays[nextPlanned.weekday - 1].full}: `}
                <Text style={s.heroPlannedName}>{plannedName(nextPlanned)}</Text>
              </Text>
            ) : null}
            <View style={s.fitnessActions}>
              {workoutUnknown ? (
                // The error notice above already offers the retry; never guess between start and create.
                goalError ? null : (
                  <View style={[s.heroButton, s.heroButtonBusy]}>
                    <ActivityIndicator accessibilityLabel="Carregando seus treinos" color={c.onPrimary} />
                  </View>
                )
              ) : (
                <Pressable accessibilityRole="button"
                  onPress={() => router.push(openRun || hasPlans ? "/workout-run" : "/workout-create")}
                  style={s.heroButton}
                >
                  <MaterialCommunityIcons
                    name={openRun || hasPlans ? "play" : "plus"}
                    size={18}
                    color={c.onPrimary}
                  />
                  <Text style={s.heroButtonText}>{openRun ? `Continuar treino ${openRun.divisionLabel}` : hasPlans ? "Iniciar treino" : "Criar ficha"}</Text>
                </Pressable>
              )}
              <Pressable accessibilityRole="button"
                onPress={() => router.push("/workouts")}
                style={s.fitnessLink}
              >
                <Text style={s.fitnessLinkText}>Ver Fitness</Text>
                <MaterialCommunityIcons
                  name="arrow-right"
                  size={16}
                  color={c.link}
                />
              </Pressable>
            </View>
          </HomeAccompanimentCard>} />

          <HomeCommunity refreshSignal={refreshSignal} />
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
            <SafeAreaView testID="home-routine-sheet" style={s.activitiesSheet} edges={["bottom"]}>
              <View style={s.shrink}>
                <View style={s.sheetHandle} />
                <View style={s.activitiesHeader}>
                  <View style={s.flex}>
                    <Text style={s.activitiesTitle}>Rotina de hoje</Text>
                    <Text style={s.activitiesSubtitle}>
                      {activitiesLoading
                        ? "Atualizando sua rotina…"
                        : `${completedActivities}/${countedActivities.length} ${countedActivities.length === 1 ? "concluída" : "concluídas"}${dismissedActivities.length ? ` · ${dismissedActivities.length} ${dismissedActivities.length === 1 ? "dispensada" : "dispensadas"}` : ""}`}
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
                  {routineErrorText ? <View style={s.activitiesNotice}>
                    <Text accessibilityRole="alert" style={{ color: c.danger }}>{routineErrorText}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel="Tentar atualizar a rotina novamente" onPress={retryRoutine} style={s.heroInlineAction}><Text style={s.heroInlineActionText}>Tentar novamente</Text></Pressable>
                  </View> : null}
                  {activityGroups.map(group => <View key={group.key}>
                    {activityGroups.length > 1 || group.key !== 'other' ? <View style={s.activityGroupHeader}><Text style={s.activityGroupTitle}>{groupTitle(group)}</Text>{group.key !== 'other' && group.items.filter(item => !item.done).length > 1 ? <Pressable accessibilityRole="button" accessibilityLabel={group.time ? `Marcar todas as doses das ${group.time}` : 'Marcar todas as doses sem horário'} disabled={Boolean(activityBusy) || Boolean(medications.error || supplements.error)} onPress={() => void markGroup(group.key, group.items)} style={s.activityGroupAction}>{activityBusy === `group:${group.key}` ? <ActivityIndicator color={c.link}/> : <Text style={s.activityGroupActionText}>Marcar todos</Text>}</Pressable> : null}</View> : null}
                  {group.items.map((activity) => (
                    <View key={activity.id} style={s.activityRow}>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Ver ${activity.title}`} onPress={() => openDailyActivity(activity)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 60 }}>
                        {activity.injectableItem ? <InjectableIllustration item={activity.injectableItem} size={44}/> : activity.healthItem && activity.healthKind ? <HealthIllustration item={activity.healthItem} kind={activity.healthKind}/> : activity.scene ? <SceneThumb scene={activity.scene} size={44}/> : <View style={[s.activityIcon, activity.done && s.activityIconDone]}><MaterialCommunityIcons name={activity.done ? 'check' : activity.icon} size={20} color={activity.done ? c.background : c.link}/></View>}
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
                  {!dailyActivities.length && !activitiesLoading && !routineErrorText ? (
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
            error={goalSaveError}
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
              <Text style={s.menuVersion}>Versão {RELEASE_VERSION}</Text>
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
      <View style={{ opacity: 0.5 }}>{activity.injectableItem ? <InjectableIllustration item={activity.injectableItem} size={44}/> : activity.healthItem && activity.healthKind ? <HealthIllustration item={activity.healthItem} kind={activity.healthKind}/> : activity.scene ? <SceneThumb scene={activity.scene} size={44}/> : <View style={s.activityIcon}><MaterialCommunityIcons name={activity.icon} size={20} color={c.textMuted}/></View>}</View>
      <View style={s.flex}><Text style={[s.activityTitle, s.activityTitleDone]}>{activity.title}</Text><Text style={s.activityDetail}>Dispensada · {activity.detail}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Desfazer dispensa de ${activity.title}`} disabled={Boolean(busy)} onPress={() => onRestore(activity)} style={s.activityGroupAction}>
        {busy === `dismiss:${activity.id}` ? <ActivityIndicator color={c.link} /> : <Text style={s.activityGroupActionText}>Desfazer</Text>}
      </Pressable>
    </View>) : null}
  </View>;
}

const createStyles = (c: AppPalette) =>
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
    contentWide: { maxWidth: 1120 },
    flex: { flex: 1, minWidth: 0 },
    header: { gap: 8, marginBottom: 2 },
    headerTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerActions: { flexDirection: "row", gap: 10 },
    headerCopy: { gap: 2 },
    communityHeaderButton: { width: "auto", paddingHorizontal: 12, flexDirection: "row", gap: 6 },
    communityHeaderLabel: { ...Type.label, color: c.link, fontWeight: "700" },
    date: {
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0.7,
      textTransform: "uppercase",
      color: c.link,
    },
    greeting: {
      fontSize: 24,
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
      // Sheets keep a phone-sized column on tablets and desktop web.
      width: "100%",
      maxWidth: 560,
      alignSelf: "center",
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
    heroAdjust: { width: 44, height: 44, borderRadius: 12, backgroundColor: c.surfaceSoft, alignItems: "center", justifyContent: "center" },
    heroProgress: { flexDirection: "row", alignItems: "center", gap: 10 },
    heroNumber: {
      fontSize: 27,
      fontWeight: "800",
      letterSpacing: -1,
      color: c.text,
    },
    heroTotal: { fontSize: 15, fontWeight: "700", color: c.textMuted },
    heroCaption: { ...Type.label, color: c.text, fontWeight: "700" },
    heroNotice: { gap: 8 },
    heroInlineAction: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center", paddingHorizontal: 16, borderRadius: 12, backgroundColor: c.primarySoft },
    heroInlineActionText: { ...Type.label, fontWeight: "800", color: c.link },
    heroHint: { ...Type.caption, color: c.textMuted, marginTop: 2 },
    heroPlanned: { ...Type.label, color: c.textMuted },
    heroPlannedName: { color: c.text, fontWeight: "700" },
    heroButtonBusy: { opacity: 0.6 },
    track: {
      height: 5,
      borderRadius: 8,
      backgroundColor: c.surfaceSoft,
      overflow: "hidden",
    },
    fill: { height: "100%", borderRadius: 8, backgroundColor: c.primary },
    week: { flexDirection: "row", justifyContent: "space-between", gap: 4 },
    day: {
      flex: 1,
      minWidth: 0,
      // Grows with enlarged system text instead of clipping the second line.
      minHeight: 46,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: c.surfaceSoft,
      alignItems: "center",
      justifyContent: "center",
      gap: 1,
    },
    dayDone: { backgroundColor: c.secondary },
    dayToday: { borderWidth: 2, borderColor: c.link },
    dayPlanned: { borderWidth: 1, borderColor: c.fieldBorder },
    dayMissed: { borderStyle: "dashed", borderColor: c.warning },
    dayStatusMissed: { color: c.warning },
    dayText: { fontSize: 12, color: c.textMuted, fontWeight: "700" },
    dayTextDone: { color: c.primaryStrong },
    dayStatus: { minHeight: 16, fontSize: 12, color: c.textMuted, fontWeight: "700" },
    dayStatusDone: { color: c.primaryStrong },
    dayStatusPlanned: { color: c.link },
    fitnessActions: { gap: 12, marginTop: "auto" },
    heroButton: {
      minHeight: 48,
      borderRadius: 16,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: 15,
    },
    heroButtonText: { ...Type.label, fontWeight: "800", color: c.onPrimary },
    fitnessLink: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
    },
    fitnessLinkText: { ...Type.label, fontWeight: "700", color: c.link },
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
    todayNextError: { color: c.danger },
    todayTitleLate: { color: c.warning },
    activitiesNotice: { gap: 8, paddingVertical: 12 },
    activitiesOverlay: { flex: 1, backgroundColor: Scrim, justifyContent: "flex-end" },
    activitiesSheet: {
      width: "100%",
      maxWidth: 560,
      alignSelf: "center",
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
