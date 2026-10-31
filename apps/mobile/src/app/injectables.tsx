import { useAuth } from "@/auth/auth-context";
import { InjectableForm } from "@/components/injectable-form";
import { InformationModal } from "@/components/information-modal";
import { CardShadow, Scrim, type AppPalette } from "@/constants/theme";
import { confirmAction, showToast } from "@/components/app-dialog";
import { ScreenHeader } from "@/components/screen-header";
import { formatDate, formatRelativeDay, formatShortDate, localDate, parseLocalDate, shiftDate } from "@/utils/dates";
import { useAppTheme } from "@/theme/theme-provider";
import type {
  Injectable,
  InjectableEstimate,
  InjectableInput,
  InjectableToday,
} from "@fit/contracts";
import MaterialCommunityIcons from '@/components/icon';
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/** Same chart, one name everywhere. */
const CHART_TITLE = "Quantidade estimada no organismo";
/** Next scheduled day after `from` (weekdays use 1 = segunda … 7 = domingo). */
const nextScheduledDate = (weekdays: number[], from: string) => {
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = shiftDate(from, offset);
    if (weekdays.includes(((parseLocalDate(candidate).getDay() + 6) % 7) + 1)) return candidate;
  }
  return null;
};
const weekdayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const unitLabel = (item: { unit: string; customUnit?: string | null }) =>
  item.unit === "iu"
    ? "UI"
    : item.unit === "clicks"
      ? "cliques"
      : item.unit === "other"
        ? (item.customUnit ?? "un.")
        : item.unit;
const amount = (value: number) =>
  Number.isInteger(value)
    ? String(value)
    : value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
export default function InjectablesScreen() {
  const { colors: c } = useAppTheme();
  const s = styles(c);
  const { api } = useAuth();
  const date = localDate();
  const [items, setItems] = useState<Injectable[]>([]);
  const [today, setToday] = useState<InjectableToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Injectable | null | undefined>(undefined);
  const [info, setInfo] = useState<"general" | "estimate" | null>(null);
  const [chartOpen, setChartOpen] = useState(false);
  const [estimateError, setEstimateError] = useState('');
  const [estimateAttempt, setEstimateAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [estimate, setEstimate] = useState<InjectableEstimate | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [applying, setApplying] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      const [list, daily] = await Promise.all([
        api.listInjectables(),
        api.getInjectablesToday(date),
      ]);
      setItems(list);
      setToday(daily);
      setSelectedId((current) =>
        list.some((item) => item.id === current)
          ? current
          : (list.find((item) => item.active)?.id ?? list[0]?.id ?? ""),
      );
    } catch {
      setError("Não foi possível carregar seus injetáveis.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api, date]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useEffect(() => {
    if (!chartOpen || !selectedId) return;
    let active = true;
    void Promise.resolve().then(() => { if (active) { setEstimateLoading(true); setEstimate(null); setEstimateError(''); } });
    api
      .getInjectableEstimate(selectedId)
      .then((value) => {
        if (active) setEstimate(value);
      })
      .catch(() => {
        if (active) { setEstimate(null); setEstimateError('Não foi possível carregar a estimativa. Tente novamente.'); }
      })
      .finally(() => {
        if (active) setEstimateLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, selectedId, items, chartOpen, estimateAttempt]);
  const selected = items.find((item) => item.id === selectedId);
  const visiblePoints = useMemo(
    () =>
      estimate?.points ?? [],
    [estimate],
  );
  const maxPoint = Math.max(...visiblePoints.map((point) => point.amount), 1);
  const setApplied = async (id: string, applied: boolean) => {
    setApplying(id);
    try {
      await api.setInjectableApplication(id, date, applied);
      await load();
      showToast(applied ? "Aplicação registrada." : "Aplicação desfeita.");
    } catch {
      showToast("Não foi possível atualizar a aplicação. Confira a conexão e tente novamente.", "error");
    } finally {
      setApplying("");
    }
  };
  const remove = async (item: Injectable) => {
    const confirmed = await confirmAction({
      title: "Excluir injetável?",
      message: `O cadastro de ${item.name} e todo o histórico de aplicações serão removidos.`,
      confirmLabel: "Excluir injetável",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await api.deleteInjectable(item.id);
      showToast("Injetável excluído.");
      await load();
    } catch {
      showToast(`Não foi possível excluir ${item.name}. Confira a conexão e tente novamente.`, "error");
    }
  };
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
          />
        }
        contentContainerStyle={s.content}
      >
        <ScreenHeader backLabel="Saúde" />
        <View style={s.header}>
          <View style={s.grow}>
            <Text accessibilityRole="header" style={s.heading}>
              Injetáveis
            </Text>
            <Text style={s.subheading}>
              Agenda, aplicações e quantidade estimada
            </Text>
          </View>
          <Pressable accessibilityRole="button"
            accessibilityLabel="Sobre o acompanhamento de injetáveis"
            onPress={() => setInfo("general")}
            style={s.infoButton}
          >
            <MaterialCommunityIcons
              name="information-outline"
              size={21}
              color={c.link}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cadastrar injetável"
            onPress={() => setForm(null)}
            style={s.add}
          >
            <MaterialCommunityIcons name="plus" size={18} color={c.onPrimary} />
            <Text style={s.addText}>Cadastrar</Text>
          </Pressable>
        </View>
        <View style={s.safety}>
          <MaterialCommunityIcons
            name="medical-bag"
            size={22}
            color={c.warning}
          />
          <Text style={s.safetyText}>
            Use somente conforme sua prescrição e o treinamento de um
            profissional habilitado.
          </Text>
        </View>
        {error ? (
          <View accessibilityRole="alert" style={s.errorBox}>
            <Text style={s.error}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => void load()} style={s.retry}>
              <Text style={s.link}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : null}
        {loading ? (
          <ActivityIndicator color={c.link} style={s.loading} />
        ) : (
          <>
            <View style={s.sectionHeader}>
              <View>
                <Text style={s.sectionTitle}>Hoje</Text>
                <Text style={s.sectionSubtitle}>
                  Aplicações previstas para{" "}
                  {parseLocalDate(date).toLocaleDateString("pt-BR", {
                    weekday: "long",
                  })}
                </Text>
              </View>
            </View>
            {today?.items.length ? (
              <View style={[s.todayCard, CardShadow]}>
                {today.items.map(({ injectable, application }, index) => (
                  <View
                    key={injectable.id}
                    style={[s.todayRow, index > 0 && s.divider]}
                  >
                    <View style={[s.todayIcon, application && s.todayDone]}>
                      <MaterialCommunityIcons
                        name={application ? "check" : "needle"}
                        size={23}
                        color={application ? c.onPrimary : c.link}
                      />
                    </View>
                    <View style={s.grow}>
                      <Text style={s.itemName}>Hoje tem {injectable.name}</Text>
                      <Text style={s.itemMeta}>
                        {amount(injectable.dose)} {unitLabel(injectable)} ·{" "}
                        {application ? "Aplicado" : "Pendente"}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={application ? `Desfazer aplicação de ${injectable.name}` : `Marcar ${injectable.name} como aplicado hoje`}
                      disabled={applying === injectable.id}
                      onPress={() =>
                        void setApplied(injectable.id, !application)
                      }
                      style={[s.apply, application && s.applyUndo]}
                    >
                      {applying === injectable.id ? (
                        <ActivityIndicator
                          size="small"
                          color={application ? c.link : c.onPrimary}
                        />
                      ) : (
                        <Text
                          style={[s.applyText, application && s.applyUndoText]}
                        >
                          {application ? "Desfazer" : "Marcar"}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <View style={s.emptyToday}>
                <MaterialCommunityIcons
                  name="calendar-blank-outline"
                  size={25}
                  color={c.link}
                />
                <View style={s.grow}>
                  <Text style={s.emptyTodayTitle}>Nada previsto para hoje</Text>
                  <Text style={s.muted}>
                    Os dias selecionados no cadastro aparecem automaticamente.
                  </Text>
                </View>
              </View>
            )}

            {items.length ? <Pressable accessibilityRole="button" onPress={() => { setEstimateLoading(true); setChartOpen(true); }} style={s.outline}><Text style={s.link}>Ver quantidade estimada no organismo</Text></Pressable> : null}

            <View style={s.sectionHeader}>
              <View>
                <Text style={s.sectionTitle}>Meus injetáveis</Text>
                <Text style={s.sectionSubtitle}>
                  Toque em um item para ver sua estimativa
                </Text>
              </View>
            </View>
            {items.length ? (
              <View style={s.list}>
                {items.map((item) => (
                  <View
                    key={item.id}
                    style={[
                      s.itemCard,
                      item.id === selectedId && s.itemSelected,
                      !item.active && s.paused,
                    ]}
                  >
                    {/* Main area and row actions are siblings so no button is nested in another. */}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Ver quantidade estimada de ${item.name}`}
                      aria-selected={item.id === selectedId}
                      onPress={() => {
                        setEstimateLoading(true);
                        setSelectedId(item.id);
                        setChartOpen(true);
                      }}
                      style={s.itemMain}
                    >
                    <View style={s.itemIcon}>
                      <MaterialCommunityIcons
                        name="needle"
                        size={22}
                        color={c.link}
                      />
                    </View>
                    <View style={s.grow}>
                      <View style={s.itemTitleRow}>
                        <Text style={s.itemName}>{item.name}</Text>
                        {!item.active ? (
                          <Text style={s.pausedBadge}>Pausado</Text>
                        ) : null}
                      </View>
                      <Text style={s.itemMeta}>
                        {amount(item.dose)} {unitLabel(item)} ·{" "}
                        {item.weekdays
                          .map((day) => weekdayLabels[day - 1])
                          .join(", ")}
                      </Text>
                      <Text style={s.itemMeta}>
                        {item.halfLifeDays ? `Meia-vida: ${amount(item.halfLifeDays)} dias` : 'Meia-vida não informada · gráfico indisponível'}
                      </Text>
                    </View>
                    </Pressable>
                    <View style={s.itemActions}>
                      <Pressable accessibilityRole="button"
                        accessibilityLabel={`Editar ${item.name}`}
                        style={s.iconButton}
                        onPress={(event) => {
                                                    setForm(item);
                        }}
                      >
                        <MaterialCommunityIcons
                          name="pencil-outline"
                          size={20}
                          color={c.link}
                        />
                      </Pressable>
                      <Pressable accessibilityRole="button"
                        accessibilityLabel={`Excluir ${item.name}`}
                        style={s.iconButton}
                        onPress={(event) => {
                                                    void remove(item);
                        }}
                      >
                        <MaterialCommunityIcons
                          name="trash-can-outline"
                          size={20}
                          color={c.danger}
                        />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={s.empty}>
                <View style={s.emptyIcon}>
                  <MaterialCommunityIcons
                    name="needle"
                    size={28}
                    color={c.link}
                  />
                </View>
                <Text style={s.emptyTitle}>Nenhum injetável cadastrado</Text>
                <Text style={s.muted}>
                  Cadastre somente produtos prescritos e use os dias informados
                  pelo profissional que acompanha você.
                </Text>
                <Pressable accessibilityRole="button" onPress={() => setForm(null)} style={s.outline}>
                  <Text style={s.link}>Cadastrar primeiro injetável</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </ScrollView>
      {chartOpen ? <Modal visible transparent animationType="slide" onRequestClose={() => setChartOpen(false)}>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', padding: 16, backgroundColor: Scrim }}>
          <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 680, alignSelf: 'center', maxHeight: '92%', backgroundColor: c.surface, borderRadius: 24, padding: 16 }}>
            <View style={s.header}><Text accessibilityRole="header" style={[s.sectionTitle, s.grow]}>{CHART_TITLE}</Text><Pressable accessibilityRole="button" accessibilityLabel="Fechar gráfico" onPress={() => setChartOpen(false)} style={s.infoButton}><MaterialCommunityIcons name="close" size={22} color={c.link}/></Pressable></View>
            <ScrollView contentContainerStyle={{ gap: 16, paddingTop: 16 }}>
              <Text style={s.muted}>Quanto de cada dose registrada ainda restaria, calculado pela meia-vida informada. É uma estimativa matemática, não uma medição no sangue. Selecione o medicamento:</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{items.map(item => <Pressable key={item.id} accessibilityRole="radio" aria-checked={item.id === selectedId}  onPress={() => { if (item.id !== selectedId) { setEstimateLoading(true); setEstimate(null); setSelectedId(item.id); } }} style={[s.outline, selectedId === item.id && s.itemSelected]}><Text style={s.link}>{item.name}</Text></Pressable>)}</View>
              {estimateError ? <View accessibilityRole="alert"><Text style={s.error}>{estimateError}</Text><Pressable accessibilityRole="button" style={s.outline} onPress={() => setEstimateAttempt(value => value + 1)}><Text style={s.link}>Tentar novamente</Text></Pressable></View> : null}
            {selected?.halfLifeDays ? (
              <>
                <View style={s.sectionHeader}>
                  <View>
                    <Text style={s.sectionTitle}>{selected.name}</Text>
                    <Text style={s.sectionSubtitle}>
                      Meia-vida informada: {amount(selected.halfLifeDays)} dias
                    </Text>
                  </View>
                  <Pressable accessibilityRole="button"
                    accessibilityLabel="Entender a quantidade estimada"
                    onPress={() => setInfo("estimate")}
                    style={s.smallInfo}
                  >
                    <MaterialCommunityIcons
                      name="information-outline"
                      size={19}
                      color={c.link}
                    />
                  </Pressable>
                </View>
                <View style={[s.estimateCard, CardShadow]}>
                  <View style={s.estimateTop}>
                    <View>
                      <Text style={s.estimateEyebrow}>
                        Estimada para hoje
                      </Text>
                      {estimateLoading ? (
                        <ActivityIndicator
                          color={c.link}
                          style={s.estimateSpinner}
                        />
                      ) : (
                        <Text style={s.estimateValue}>
                          {estimate ? amount(estimate.estimatedAmount) : "—"}{" "}
                          <Text style={s.estimateUnit}>
                            {unitLabel(selected)}
                          </Text>
                        </Text>
                      )}
                    </View>
                    <View style={s.curveIcon}>
                      <MaterialCommunityIcons
                        name="chart-bell-curve-cumulative"
                        size={25}
                        color={c.link}
                      />
                    </View>
                  </View>
                  {estimate && estimate.injectableId === selectedId && estimate.applications.length > 0 && !estimateLoading ? (
                    <>
                      <View accessible accessibilityRole="image" accessibilityLabel={chartSummary(selected, estimate, maxPoint, date)}>
                        <Text style={s.estimateNote}>{amount(maxPoint)} {unitLabel(selected)}</Text>
                        <RemainingCurve points={visiblePoints} maximum={maxPoint} color={c.secondary}/>
                        <Text style={s.estimateNote}>30 dias atrás → Hoje · intervalos de 12h</Text>
                      </View>
                      <Text style={s.estimateNote}>
                        Estimativa matemática pela meia-vida. Não representa
                        exame, absorção nem concentração no sangue.
                      </Text>
                      {estimate.excludedApplications ? (
                        <Text style={s.excluded}>
                          {estimate.excludedApplications} aplicação(ões) em
                          outra unidade não foram somadas.
                        </Text>
                      ) : null}
                    </>
                  ) : (
                    <Text style={s.muted}>
                      {estimateLoading
                        ? "Calculando…"
                        : "Registre uma aplicação para visualizar a curva."}
                    </Text>
                  )}
                </View>
                {estimate?.applications.length ? (
                  <View style={s.historyCard}>
                    <Text style={s.historyTitle}>Aplicações recentes</Text>
                    {estimate.applications
                      .slice(0, 6)
                      .map((application, index) => (
                        <View
                          key={application.id}
                          style={[s.historyRow, index > 0 && s.divider]}
                        >
                          <MaterialCommunityIcons
                            name="check-circle-outline"
                            size={19}
                            color={c.success}
                          />
                          <Text style={s.historyDate}>
                            {formatDate(application.date)}
                          </Text>
                          <Text style={s.historyDose}>
                            {amount(application.dose)} {unitLabel(application)}
                          </Text>
                        </View>
                      ))}
                  </View>
                ) : null}
              </>
            ) : <Text style={s.muted}>Informe a meia-vida no cadastro deste medicamento para visualizar a estimativa.</Text>}

            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal> : null}
      {form !== undefined ? (
        <InjectableForm
          initial={form}
          onClose={() => setForm(undefined)}
          onSave={async (input: InjectableInput, active: boolean) => {
            if (form) await api.updateInjectable(form.id, { ...input, active });
            else await api.createInjectable(input);
            setForm(undefined);
            await load();
          }}
        />
      ) : null}
      {info === "general" ? (
        <InformationModal
          title="Acompanhamento de injetáveis"
          paragraphs={[
            "Este recurso organiza os dias prescritos e permite registrar quando uma aplicação foi realizada. Ele não recomenda medicamentos, doses ou frequências.",
            "Cadastre a unidade exatamente como consta na sua prescrição ou produto. mg, mL, UI e cliques não são equivalentes e o Fit não faz conversões.",
            "Para tirzepatida, a referência aprovada descreve aplicação uma vez por semana e meia-vida aproximada de cinco dias. Qualquer mudança deve ser discutida com o profissional responsável.",
          ]}
          onClose={() => setInfo(null)}
        />
      ) : null}
      {info === "estimate" ? (
        <InformationModal
          title="O que o gráfico significa"
          paragraphs={[
            "O gráfico soma cada dose registrada e reduz matematicamente sua quantidade pela metade a cada período de meia-vida configurado.",
            "É uma estimativa educativa da quantidade estimada no organismo, na mesma unidade registrada. Não mede concentração no sangue, efeito clínico, absorção ou segurança para uma nova dose.",
            "Nunca antecipe, repita ou altere uma aplicação com base no gráfico. Em caso de dúvida, consulte a bula, o prescritor ou o farmacêutico.",
          ]}
          onClose={() => setInfo(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}
/** Spoken summary of the curve: today, peak and next scheduled application. */
function chartSummary(item: Injectable, estimate: InjectableEstimate, maximum: number, today: string) {
  const unit = unitLabel(item);
  const peak = estimate.points.find((point) => point.amount === maximum);
  const next = item.active ? nextScheduledDate(item.weekdays, today) : null;
  return [
    `${CHART_TITLE} de ${item.name} nos últimos 30 dias.`,
    `Hoje: cerca de ${amount(estimate.estimatedAmount)} ${unit}.`,
    peak ? `Pico: ${amount(maximum)} ${unit} em ${formatShortDate(peak.at.slice(0, 10))}.` : "",
    next ? `Próxima aplicação prevista: ${formatRelativeDay(next).toLocaleLowerCase("pt-BR")}.` : "",
  ].filter(Boolean).join(" ");
}
function RemainingCurve({points,maximum,color}:{points:InjectableEstimate['points'];maximum:number;color:string}) {
  const [width,setWidth]=useState(0);
  return <View onLayout={event=>setWidth(event.nativeEvent.layout.width)} style={{height:110,position:'relative',borderBottomWidth:1,borderBottomColor:color}}>
    {points.slice(1).map((point,index)=>{
      const dx=width/Math.max(1,points.length-1);
      const start=100-points[index].amount/maximum*96;
      const end=100-point.amount/maximum*96;
      const length=Math.sqrt(dx*dx+(end-start)*(end-start));
      return <View key={point.at} style={{position:'absolute',left:index*dx+(dx-length)/2,top:(start+end)/2,height:2,width:length,backgroundColor:color,transform:[{rotate:`${Math.atan2(end-start,dx)}rad`}]}}/>;
    })}
  </View>;
}

const styles = (c: AppPalette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    content: {
      padding: 20,
      paddingBottom: 55,
      gap: 16,
      maxWidth: 720,
      width: "100%",
      alignSelf: "center",
    },
    retry: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
    iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      flexWrap: "wrap",
    },
    grow: { flex: 1, minWidth: 0 },
    heading: { fontSize: 29, fontWeight: "800", color: c.text },
    subheading: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    infoButton: {
      width: 44,
      height: 44,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    add: {
      flexDirection: "row",
      gap: 5,
      alignItems: "center",
      backgroundColor: c.primary,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    addText: { color: c.onPrimary, fontSize: 12, fontWeight: "800" },
    safety: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 9,
      backgroundColor: c.warningSoft,
      borderRadius: 16,
      padding: 13,
    },
    safetyText: { flex: 1, color: c.textMuted, fontSize: 12, lineHeight: 17 },
    errorBox: {
      backgroundColor: c.dangerSoft,
      borderRadius: 16,
      padding: 13,
      gap: 8,
    },
    error: { color: c.danger, fontSize: 12 },
    link: { color: c.link, fontSize: 12, fontWeight: "800" },
    loading: { padding: 38 },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginTop: 2,
    },
    sectionTitle: { fontSize: 19, fontWeight: "800", color: c.text },
    sectionSubtitle: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    smallInfo: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: c.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    todayCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      paddingHorizontal: 14,
    },
    todayRow: {
      minHeight: 77,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
    },
    divider: { borderTopWidth: 1, borderTopColor: c.border },
    todayIcon: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: c.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    todayDone: { backgroundColor: c.success },
    itemName: { color: c.text, fontSize: 14, fontWeight: "800" },
    itemMeta: {
      color: c.textMuted,
      fontSize: 12,
      lineHeight: 15,
      marginTop: 2,
    },
    apply: {
      minWidth: 78,
      minHeight: 44,
      justifyContent: "center",
      backgroundColor: c.primary,
      borderRadius: 12,
      paddingHorizontal: 11,
      alignItems: "center",
    },
    applyUndo: { backgroundColor: c.primarySoft },
    applyText: { color: c.onPrimary, fontSize: 12, fontWeight: "800" },
    applyUndoText: { color: c.link },
    emptyToday: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      padding: 15,
    },
    emptyTodayTitle: { color: c.text, fontSize: 13, fontWeight: "800" },
    muted: { color: c.textMuted, fontSize: 12, lineHeight: 17 },
    estimateCard: {
      backgroundColor: c.primaryStrong,
      borderRadius: 24,
      padding: 17,
      gap: 13,
    },
    estimateTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    estimateEyebrow: {
      color: c.heroMuted,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    estimateValue: {
      color: c.onPrimary,
      fontSize: 27,
      fontWeight: "800",
      marginTop: 4,
    },
    estimateUnit: { fontSize: 15, color: c.heroMuted },
    estimateSpinner: { marginTop: 10, alignSelf: "flex-start" },
    curveIcon: {
      width: 47,
      height: 47,
      borderRadius: 16,
      backgroundColor: c.heroTint,
      alignItems: "center",
      justifyContent: "center",
    },
    chart: {
      height: 82,
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 3,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(255,255,255,.18)",
    },
    barSlot: {
      flex: 1,
      height: 78,
      alignItems: "center",
      justifyContent: "flex-end",
    },
    bar: {
      width: "70%",
      maxWidth: 21,
      minWidth: 3,
      backgroundColor: c.secondary,
      borderTopLeftRadius: 4,
      borderTopRightRadius: 4,
    },
    barDate: {
      position: "absolute",
      bottom: -14,
      color: c.heroMuted,
      fontSize: 12,
    },
    estimateNote: {
      color: c.heroMuted,
      fontSize: 12,
      lineHeight: 14,
      marginTop: 8,
    },
    excluded: { color: c.heroWarning, fontSize: 12 },
    historyCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      paddingHorizontal: 14,
    },
    historyTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: c.text,
      paddingVertical: 13,
    },
    historyRow: {
      minHeight: 45,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },
    historyDate: { flex: 1, color: c.text, fontSize: 12, fontWeight: "700" },
    historyDose: { color: c.link, fontSize: 12, fontWeight: "800" },
    list: { gap: 9 },
    itemCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      padding: 13,
    },
    itemMain: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 11 },
    itemSelected: { borderColor: c.primary, backgroundColor: c.primarySoft },
    paused: { opacity: 0.68 },
    itemIcon: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: c.surfaceSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    itemTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    pausedBadge: {
      fontSize: 12,
      color: c.warning,
      fontWeight: "800",
      backgroundColor: c.warningSoft,
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 8,
    },
    itemActions: { flexDirection: "row", alignItems: "center", marginRight: -8 },
    empty: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      padding: 20,
      gap: 9,
    },
    emptyIcon: {
      width: 50,
      height: 50,
      borderRadius: 16,
      backgroundColor: c.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyTitle: { color: c.text, fontSize: 17, fontWeight: "800" },
    outline: {
      alignSelf: "flex-start",
      minHeight: 44,
      justifyContent: "center",
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: 12,
      padding: 11,
    },
  });
