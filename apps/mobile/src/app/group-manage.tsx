import { FormScrollView as ScrollView } from '@/components/form-scroll-view';
import { FormInput as TextInput } from '@/components/form-input';
import MaterialCommunityIcons from '@/components/icon';
import { ContextHelp } from '@/components/context-help';
import type {
  GroupDetails,
  GroupEventSettings,
  GroupMember,
  GroupReport,
  GroupRole,
  GroupSharePreferences,
} from "@fit/contracts";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState, type ReactNode } from "react";
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
import { useAuth } from "@/auth/auth-context";
import { CardShadow, Radius, Scrim, Type, type AppPalette } from "@/constants/theme";
import { useAppTheme } from "@/theme/theme-provider";
import { confirmAction, showDialog, showToast } from "@/components/app-dialog";
import { ScreenHeader } from "@/components/screen-header";
import { formatRelativeDay, localDate } from "@/utils/dates";
import { groupErrorMessage, groupRoleDescriptions, groupRoleLabels, reportReasonLabel } from "@/utils/groups";

const assignableRoles: Exclude<GroupRole, "owner">[] = ["member", "moderator", "admin"];
const reportDate = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : formatRelativeDay(localDate(date)); };

const labels: Record<
  keyof GroupEventSettings,
  {
    title: string;
    description: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
  }
> = {
  workout_completed: {
    title: "Treino concluído",
    description: "Conquistas de musculação e fichas",
    icon: "dumbbell",
  },
  cardio_completed: {
    title: "Cardio concluído",
    description: "Corrida, caminhada, bike e outros",
    icon: "heart-pulse",
  },
  weekly_goal: {
    title: "Meta semanal",
    description: "Quando alguém alcançar a meta",
    icon: "target",
  },
  weekly_streak: {
    title: "Sequência semanal",
    description: "Semanas consecutivas com meta atingida",
    icon: "fire",
  },
  member_joined: {
    title: "Novo membro",
    description: "Mensagem administrativa de entrada",
    icon: "account-plus",
  },
};

export default function GroupManage() {
  const { id, section } = useLocalSearchParams<{ id: string; section?: string }>();
  const { colors: c } = useAppTheme();
  const s = styles(c);
  const { api, user } = useAuth();
  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [reports, setReports] = useState<GroupReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [inviting, setInviting] = useState(false);
  const [roleMember, setRoleMember] = useState<GroupMember | null>(null);
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleError, setRoleError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!id) return;
    setLoadError("");
    try {
      const g = await api.getGroup(id);
      setGroup(g);
      const memberResult = await api.listGroupMembers(id);
      setMembers(memberResult);
      if (["owner", "admin", "moderator"].includes(g.role))
        setReports(await api.listGroupReports(id));
    } catch (failure) {
      setLoadError(groupErrorMessage(failure, { not_found: "Este grupo não está mais disponível para você.", server: "Não foi possível carregar as configurações." }));
    } finally {
      setLoading(false);
    }
  }, [api, id]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const saveEvents = async (next: GroupEventSettings) => {
    if (!id) return;
    setMessage("");
    setGroup((value) => (value ? { ...value, eventSettings: next } : value));
    try {
      await api.updateGroupEvents(id, next);
      showToast("Tipos de compartilhamento atualizados.");
    } catch (failure) {
      await load();
      setMessage(groupErrorMessage(failure, { forbidden: "Somente proprietário e administração alteram o que o grupo aceita." }));
    }
  };
  const savePrefs = async (next: GroupSharePreferences) => {
    if (!id) return;
    setMessage("");
    setGroup((value) => (value ? { ...value, sharePreferences: next } : value));
    try {
      await api.updateGroupPreferences(id, next);
      showToast("Suas preferências foram atualizadas.");
    } catch (failure) {
      await load();
      setMessage(groupErrorMessage(failure, { conflict: "Esse tipo de atividade não está habilitado no grupo." }));
    }
  };
  const saveGroup = async (input: { postingMode?: "admins_only" | "all_members"; commentsEnabled?: boolean }) => {
    if (!id) return;
    setMessage("");
    try {
      await api.updateGroup(id, input);
      await load();
      showToast("Configuração do grupo atualizada.");
    } catch (failure) {
      await load();
      setMessage(groupErrorMessage(failure, { forbidden: "Somente proprietário e administração alteram esta configuração." }));
    }
  };
  const normalizedUsername = username.trim().replace(/^@/, "").toLowerCase();
  const invite = async () => {
    if (!id || normalizedUsername.length < 3 || inviting) return;
    setMessage("");
    setInviting(true);
    try {
      await api.inviteGroupMember(id, normalizedUsername);
      setUsername("");
      showToast(`Convite enviado para @${normalizedUsername}.`);
    } catch (failure) {
      setMessage(groupErrorMessage(failure, {
        not_found: `Não encontramos @${normalizedUsername}. Confira o identificador público exato.`,
        conflict: `@${normalizedUsername} já participa do grupo, já tem um convite pendente ou é você.`,
        forbidden: "Somente proprietário e administração podem convidar.",
        invalid: "Use de 3 a 30 caracteres: letras minúsculas, números, ponto ou sublinhado.",
      }));
    } finally {
      setInviting(false);
    }
  };
  const applyRole = async (member: GroupMember, next: Exclude<GroupRole, "owner">) => {
    if (!id || roleSaving) return;
    if (next === member.role) return setRoleMember(null);
    if (next === "admin") {
      const confirmed = await confirmAction({
        title: `Tornar ${member.user.displayName} administração?`,
        message: "Essa pessoa poderá editar o grupo, convidar e remover membros e resolver denúncias.",
        confirmLabel: "Promover a administração",
      });
      if (!confirmed) return;
    }
    setRoleError("");
    setRoleSaving(true);
    try {
      await api.updateGroupMemberRole(id, member.user.id, next);
      setRoleMember(null);
      await load();
      showToast(`${member.user.displayName} agora tem a função ${groupRoleLabels[next]}.`);
    } catch (failure) {
      setRoleError(groupErrorMessage(failure, {
        forbidden: "Somente o proprietário pode alterar funções.",
        not_found: "Esta pessoa não participa mais do grupo.",
      }));
    } finally {
      setRoleSaving(false);
    }
  };
  const remove = async (member: GroupMember) => {
    if (!id) return;
    const confirmed = await confirmAction({
      title: `Remover ${member.user.displayName}?`,
      message: "A pessoa perderá o acesso ao feed do grupo. Para voltar, precisará de um novo convite e não verá as publicações anteriores.",
      confirmLabel: "Remover membro",
      destructive: true,
    });
    if (!confirmed) return;
    setBusy(`member-${member.user.id}`);
    try {
      await api.removeGroupMember(id, member.user.id);
      await load();
      showToast(`${member.user.displayName} foi removido(a) do grupo.`);
    } catch (failure) {
      showToast(groupErrorMessage(failure, { forbidden: "Você não tem permissão para remover este membro.", not_found: "Esta pessoa já não participa do grupo." }), "error");
    } finally {
      setBusy(null);
    }
  };
  const transfer = async (member: GroupMember) => {
    if (!id) return;
    const confirmed = await confirmAction({
      title: "Transferir propriedade?",
      message: `${member.user.displayName} passará a ser proprietário do grupo e você continuará na administração. Só o novo proprietário poderá devolver a propriedade.`,
      confirmLabel: "Transferir propriedade",
      destructive: true,
    });
    if (!confirmed) return;
    setBusy(`member-${member.user.id}`);
    try {
      await api.transferGroupOwner(id, member.user.id);
      await load();
      showToast(`A propriedade foi transferida para ${member.user.displayName}.`);
    } catch (failure) {
      showToast(groupErrorMessage(failure, { forbidden: "Somente o proprietário pode transferir a propriedade.", not_found: "Esta pessoa já não participa do grupo." }), "error");
    } finally {
      setBusy(null);
    }
  };
  const leave = async () => {
    if (!id || !group) return;
    if (group.role === "owner") {
      showDialog("Transfira a propriedade antes de sair", "Toque no ícone de coroa ao lado de outro membro para torná-lo proprietário. Depois disso, você poderá sair do grupo.");
      return;
    }
    const confirmed = await confirmAction({
      title: "Sair do grupo?",
      message: "Você perderá o acesso ao feed. Se voltar com um novo convite, não verá as publicações anteriores.",
      confirmLabel: "Sair do grupo",
      destructive: true,
    });
    if (!confirmed) return;
    setBusy("leave");
    try {
      await api.leaveGroup(id);
      showToast(`Você saiu de ${group.name}.`);
      router.dismissTo("/groups");
    } catch (failure) {
      showToast(groupErrorMessage(failure, { conflict: "Transfira a propriedade antes de sair." }), "error");
    } finally {
      setBusy(null);
    }
  };
  const resolveReport = async (report: GroupReport, resolution: "dismissed" | "content_removed") => {
    if (!id) return;
    const subject = report.targetType === "post" ? "A publicação" : "O comentário";
    const confirmed = await confirmAction(resolution === "dismissed" ? {
      title: "Arquivar denúncia?",
      message: `${subject} continuará visível no grupo e a denúncia sairá da fila.`,
      confirmLabel: "Arquivar denúncia",
    } : {
      title: "Remover conteúdo denunciado?",
      message: `${subject} deixará de aparecer para todos os membros e a denúncia será marcada como resolvida. Essa ação não pode ser desfeita.`,
      confirmLabel: "Remover conteúdo",
      destructive: true,
    });
    if (!confirmed) return;
    setBusy(`report-${report.id}`);
    try {
      await api.resolveGroupReport(id, report.id, resolution);
      await load();
      showToast(resolution === "dismissed" ? "Denúncia arquivada." : "Conteúdo removido e denúncia resolvida.");
    } catch (failure) {
      showToast(groupErrorMessage(failure, { forbidden: "Você não tem permissão para moderar este grupo.", conflict: "Esta denúncia já foi resolvida." }), "error");
    } finally {
      setBusy(null);
    }
  };
  const admin = group?.role === "owner" || group?.role === "admin";
  const moderation = admin || group?.role === "moderator";
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader backLabel="Grupo" onBack={() => router.canGoBack() ? router.back() : router.replace('/groups')} />
        <View style={s.header}>
          <View style={s.flex}>
            <Text accessibilityRole="header" style={s.title}>
              {section === "feed" ? "Configurações do feed" : "Gerenciar grupo"}
            </Text>
            <Text style={s.subtitle}>
              {group?.name || "Configurações e privacidade"}
            </Text>
          </View>
          <ContextHelp title="Permissões e compartilhamento" paragraphs={['Suas preferências valem somente para este grupo. Desativar o compartilhamento automático afeta atividades futuras; publicações existentes podem ser removidas no feed.', 'O proprietário administra papéis e transfere a propriedade. Administradores configuram o grupo e gerenciam membros. Moderadores analisam denúncias e conteúdo.', 'Somente administradores significa que membros não iniciam publicações manuais, mas ainda podem reagir e comentar quando os comentários estiverem habilitados.', 'Para sair como proprietário, transfira antes a propriedade para outro membro.']}/>
        </View>
        {loading ? <ActivityIndicator accessibilityLabel="Carregando configurações" color={c.link} size="large" /> : null}
        {loadError ? (
          <View style={s.errorBox}>
            <Text accessibilityRole="alert" style={s.errorText}>{loadError}</Text>
            <Pressable accessibilityRole="button" onPress={() => { setLoading(true); void load(); }} style={s.retry}>
              <Text style={s.retryText}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : null}
        {message ? (
          <View style={s.errorBox}>
            <View style={s.noticeRow}>
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color={c.danger} />
              <Text accessibilityRole="alert" style={[s.errorText, s.flex]}>{message}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Fechar aviso" onPress={() => setMessage("")} style={s.noticeClose}>
                <MaterialCommunityIcons name="close" size={18} color={c.danger} />
              </Pressable>
            </View>
          </View>
        ) : null}
        {group ? (
          <>
            {section === "feed" && group.description ? <Text style={{ color: c.textMuted, lineHeight: 20 }}>{group.description}</Text> : null}
            <Section
              title="Suas preferências"
              subtitle="Você decide o que compartilhar neste grupo"
              colors={c}
            >
              {(
                Object.keys(
                  group.sharePreferences,
                ) as (keyof GroupSharePreferences)[]
              ).map((key) => (
                <Setting
                  key={key}
                  title={labels[key].title}
                  description={
                    group.eventSettings[key]
                      ? labels[key].description
                      : "Desativado pelo grupo"
                  }
                  icon={labels[key].icon}
                  value={group.sharePreferences[key]}
                  disabled={!group.eventSettings[key]}
                  onChange={(value) =>
                    savePrefs({ ...group.sharePreferences, [key]: value })
                  }
                  colors={c}
                />
              ))}
            </Section>
            {admin ? (
              <Section
                title="Convidar alguém"
                subtitle="Use o identificador público exato"
                colors={c}
              >
                <View style={s.inviteRow}>
                  <TextInput
                    accessibilityLabel="Identificador de quem você quer convidar"
                    accessibilityHint="Mínimo de 3 caracteres"
                    value={username}
                    onChangeText={setUsername}
                    onSubmitEditing={() => void invite()}
                    returnKeyType="send"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!inviting}
                    maxLength={31}
                    placeholder="@usuario"
                    placeholderTextColor={c.textMuted}
                    style={s.input}
                  />
                  <Pressable accessibilityRole="button"
                    accessibilityLabel="Enviar convite"
                    aria-disabled={normalizedUsername.length < 3 || inviting} aria-busy={inviting}
                    disabled={normalizedUsername.length < 3 || inviting}
                    onPress={() => void invite()}
                    style={[
                      s.inviteButton,
                      (normalizedUsername.length < 3 || inviting) && s.disabled,
                    ]}
                  >
                    {inviting ? <ActivityIndicator color={c.onPrimary} size="small" /> : <MaterialCommunityIcons
                      name="send"
                      size={19}
                      color={c.onPrimary}
                    />}
                  </Pressable>
                </View>
                <Text style={s.helper}>
                  {normalizedUsername.length < 3
                    ? "Digite pelo menos 3 caracteres do @usuário para enviar. A pessoa precisa aceitar o convite para entrar."
                    : "A pessoa recebe o convite em Grupos e só entra no grupo depois de aceitar."}
                </Text>
              </Section>
            ) : null}
            {admin ? (
              <Section
                title="O que o grupo aceita"
                subtitle="Permitir não obriga nenhum membro a compartilhar"
                colors={c}
              >
                {(
                  Object.keys(
                    group.eventSettings,
                  ) as (keyof GroupEventSettings)[]
                ).map((key) => (
                  <Setting
                    key={key}
                    title={labels[key].title}
                    description={labels[key].description}
                    icon={labels[key].icon}
                    value={group.eventSettings[key]}
                    onChange={(value) =>
                      saveEvents({ ...group.eventSettings, [key]: value })
                    }
                    colors={c}
                  />
                ))}
              </Section>
            ) : null}
            {admin ? (
              <Section
                title="Publicações"
                subtitle="Defina quem pode iniciar conversas"
                colors={c}
              >
                <Setting
                  title="Somente administradores"
                  description="Membros ainda podem reagir e comentar"
                  icon="shield-account-outline"
                  value={group.postingMode === "admins_only"}
                  onChange={(value) => void saveGroup({ postingMode: value ? "admins_only" : "all_members" })}
                  colors={c}
                />
                <Setting
                  title="Comentários habilitados"
                  description="Vale como padrão para novas publicações"
                  icon="comment-multiple-outline"
                  value={group.commentsEnabled}
                  onChange={(value) => void saveGroup({ commentsEnabled: value })}
                  colors={c}
                />
              </Section>
            ) : null}
            <Section
              title="Membros"
              subtitle={`${members.length} ${members.length === 1 ? "pessoa" : "pessoas"} neste grupo`}
              colors={c}
            >
              {members.map((member) => (
                <View key={member.user.id} style={s.member}>
                  <View style={s.avatar}>
                    <Text style={s.avatarText}>
                      {member.user.displayName.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={s.flex}>
                    <Text style={s.memberName}>{member.user.displayName}</Text>
                    <Text style={s.memberMeta}>
                      {member.user.username
                        ? `@${member.user.username} · `
                        : ""}
                      {groupRoleLabels[member.role]}
                      {member.user.id === user?.id ? " · Você" : ""}
                    </Text>
                  </View>
                  {busy === `member-${member.user.id}` ? <ActivityIndicator color={c.link} /> : null}
                  {group.role === "owner" && member.role !== "owner" ? (
                    <Pressable accessibilityRole="button"
                      accessibilityLabel={`Transferir propriedade para ${member.user.displayName}`}
                      disabled={busy !== null}
                      onPress={() => void transfer(member)}
                      style={s.smallAction}
                    >
                      <MaterialCommunityIcons
                        name="crown-outline"
                        size={19}
                        color={c.warning}
                      />
                    </Pressable>
                  ) : null}
                  {group.role === "owner" && member.role !== "owner" ? (
                    <Pressable accessibilityRole="button"
                      accessibilityLabel={`Alterar função de ${member.user.displayName}`}
                      disabled={busy !== null}
                      onPress={() => { setRoleError(""); setRoleMember(member); }}
                      style={s.smallAction}
                    >
                      <MaterialCommunityIcons
                        name="account-cog-outline"
                        size={19}
                        color={c.link}
                      />
                    </Pressable>
                  ) : null}
                  {admin &&
                  member.role !== "owner" &&
                  member.user.id !== user?.id ? (
                    <Pressable accessibilityRole="button"
                      accessibilityLabel={`Remover ${member.user.displayName} do grupo`}
                      disabled={busy !== null}
                      onPress={() => void remove(member)}
                      style={s.smallAction}
                    >
                      <MaterialCommunityIcons
                        name="account-remove-outline"
                        size={19}
                        color={c.danger}
                      />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </Section>
            {moderation ? (
              <Section
                title="Moderação"
                subtitle="Denúncias pendentes e decisões auditáveis"
                colors={c}
              >
                {!reports.filter((r) => r.status === "pending").length ? (
                  <Text style={s.empty}>Nenhuma denúncia pendente.</Text>
                ) : (
                  reports
                    .filter((r) => r.status === "pending")
                    .map((report) => (
                      <View key={report.id} style={s.report}>
                        <Text style={s.reportTitle}>
                          {reportReasonLabel(report.reason)} ·{" "}
                          {report.targetType === "post"
                            ? "publicação"
                            : "comentário"}
                        </Text>
                        <Text style={s.reportMeta}>
                          Enviada por {report.reporter.displayName}{reportDate(report.createdAt) ? ` · ${reportDate(report.createdAt)}` : ""}
                        </Text>
                        {report.details ? (
                          <Text style={s.reportDetails}>{report.details}</Text>
                        ) : null}
                        <View style={s.reportActions}>
                          <Pressable accessibilityRole="button"
                            disabled={busy !== null}
                            onPress={() => void resolveReport(report, "dismissed")}
                            style={s.secondary}
                          >
                            <Text style={s.secondaryText}>Arquivar denúncia</Text>
                          </Pressable>
                          <Pressable accessibilityRole="button"
                            disabled={busy !== null}
                            onPress={() => void resolveReport(report, "content_removed")}
                            style={s.dangerButton}
                          >
                            <Text style={s.dangerText}>Remover conteúdo</Text>
                          </Pressable>
                          {busy === `report-${report.id}` ? <ActivityIndicator color={c.link} /> : null}
                        </View>
                      </View>
                    ))
                )}
              </Section>
            ) : null}
            <Pressable accessibilityRole="button" aria-busy={busy === "leave"} aria-disabled={busy !== null} disabled={busy !== null} onPress={() => void leave()} style={s.leave}>
              {busy === "leave" ? <ActivityIndicator color={c.danger} /> : <MaterialCommunityIcons
                name="exit-to-app"
                size={20}
                color={c.danger}
              />}
              <Text style={s.leaveText}>
                {group.role === "owner"
                  ? "Como sair do grupo"
                  : "Sair do grupo"}
              </Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
      <Modal visible={Boolean(roleMember)} transparent animationType="slide" onRequestClose={() => { if (!roleSaving) setRoleMember(null); }}>
        <View style={s.overlay}>
          <Pressable accessibilityRole="button" accessibilityLabel="Fechar" style={StyleSheet.absoluteFill} onPress={() => { if (!roleSaving) setRoleMember(null); }} />
          <SafeAreaView edges={["bottom"]} style={s.sheet}>
            <View style={s.sheetHeader}>
              <View style={s.flex}>
                <Text accessibilityRole="header" style={s.sheetTitle}>Função de {roleMember?.user.displayName}</Text>
                <Text style={s.sectionSubtitle}>Escolha o que essa pessoa pode fazer no grupo.</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Fechar seletor de função" disabled={roleSaving} onPress={() => setRoleMember(null)} style={s.smallAction}>
                <MaterialCommunityIcons name="close" size={20} color={c.text} />
              </Pressable>
            </View>
            <View accessibilityRole="radiogroup" style={s.roleOptions}>
              {assignableRoles.map((role) => {
                const checked = roleMember?.role === role;
                return <Pressable key={role} accessibilityRole="radio" aria-checked={checked} aria-disabled={roleSaving} disabled={roleSaving} onPress={() => roleMember && void applyRole(roleMember, role)} style={[s.roleOption, checked && s.roleOptionChecked]}>
                  <MaterialCommunityIcons name={checked ? "radiobox-marked" : "radiobox-blank"} size={22} color={checked ? c.link : c.textMuted} />
                  <View style={s.flex}>
                    <Text style={s.settingTitle}>{groupRoleLabels[role]}{checked ? " (atual)" : ""}</Text>
                    <Text style={s.settingDescription}>{groupRoleDescriptions[role]}</Text>
                  </View>
                </Pressable>;
              })}
            </View>
            {roleSaving ? <ActivityIndicator accessibilityLabel="Salvando função" color={c.link} /> : null}
            {roleError ? <Text accessibilityRole="alert" style={s.errorText}>{roleError}</Text> : null}
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
function Section({
  title,
  subtitle,
  children,
  colors,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  colors: AppPalette;
}) {
  const s = styles(colors);
  return (
    <View style={[s.section, CardShadow]}>
      <View>
        <Text style={s.sectionTitle}>{title}</Text>
        <Text style={s.sectionSubtitle}>{subtitle}</Text>
      </View>
      {children}
    </View>
  );
}
function Setting({
  title,
  description,
  icon,
  value,
  onChange,
  disabled,
  colors,
}: {
  title: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  colors: AppPalette;
}) {
  const s = styles(colors);
  return (
    <View style={[s.setting, disabled && s.disabled]}>
      <View style={s.settingIcon}>
        <MaterialCommunityIcons name={icon} size={20} color={colors.link} />
      </View>
      <View style={s.flex}>
        <Text style={s.settingTitle}>{title}</Text>
        <Text style={s.settingDescription}>{description}</Text>
      </View>
      <Switch
        accessibilityLabel={title}
        accessibilityHint={description}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: colors.controlTrackOff, true: colors.primary }}
        thumbColor={colors.controlThumb}
      />
    </View>
  );
}
const styles = (c: AppPalette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    content: {
      padding: 18,
      paddingBottom: 80,
      gap: 15,
      maxWidth: 720,
      width: "100%",
      alignSelf: "center",
    },
    header: { flexDirection: "row", alignItems: "center", gap: 11 },
    errorBox: { backgroundColor: c.dangerSoft, borderRadius: Radius.lg, padding: 12, gap: 4 },
    errorText: { ...Type.label, color: c.danger, fontWeight: "600" },
    noticeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    noticeClose: { width: 44, height: 44, marginVertical: -8, marginRight: -8, alignItems: "center", justifyContent: "center", borderRadius: Radius.md },
    retry: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
    retryText: { ...Type.body, color: c.link, fontWeight: "800" },
    helper: { ...Type.caption, color: c.textMuted },
    overlay: { flex: 1, backgroundColor: Scrim, justifyContent: "flex-end" },
    sheet: { width: "100%", maxWidth: 720, alignSelf: "center", backgroundColor: c.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: 20, gap: 12 },
    sheetHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    sheetTitle: { ...Type.title, color: c.text, fontWeight: "800" },
    roleOptions: { gap: 8 },
    roleOption: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: Radius.md, borderWidth: 1, borderColor: c.border },
    roleOptionChecked: { borderColor: c.primary, backgroundColor: c.primarySoft },
    flex: { flex: 1, minWidth: 0 },
    title: { fontSize: 24, fontWeight: "800", color: c.text },
    subtitle: { fontSize: 12, color: c.textMuted },
    section: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 24,
      padding: 15,
      gap: 12,
    },
    sectionTitle: { color: c.text, fontSize: 17, fontWeight: "800" },
    sectionSubtitle: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    setting: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 4,
    },
    settingIcon: {
      width: 39,
      height: 39,
      borderRadius: 16,
      backgroundColor: c.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    settingTitle: { color: c.text, fontWeight: "800", fontSize: 13 },
    settingDescription: {
      color: c.textMuted,
      fontSize: 12,
      lineHeight: 15,
      marginTop: 2,
    },
    disabled: { opacity: 0.45 },
    inviteRow: { flexDirection: "row", gap: 9 },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      backgroundColor: c.background,
      paddingHorizontal: 13,
      paddingVertical: 12,
      color: c.text,
    },
    inviteButton: {
      width: 48,
      minHeight: 48,
      borderRadius: 16,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    member: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 5,
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 16,
      backgroundColor: c.surfaceSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { color: c.onPrimarySoft, fontWeight: "800" },
    memberName: { color: c.text, fontWeight: "800", fontSize: 13 },
    memberMeta: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    smallAction: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: c.surfaceSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    empty: {
      color: c.textMuted,
      fontSize: 12,
      textAlign: "center",
      paddingVertical: 10,
    },
    report: {
      backgroundColor: c.background,
      borderRadius: 16,
      padding: 12,
      gap: 5,
    },
    reportTitle: {
      color: c.text,
      fontWeight: "800",
      fontSize: 13,
    },
    reportMeta: { color: c.textMuted, fontSize: 12 },
    reportDetails: { color: c.text, fontSize: 12, lineHeight: 17 },
    reportActions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 6 },
    secondary: {
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 12,
      backgroundColor: c.surfaceSoft,
    },
    secondaryText: { color: c.text, fontWeight: "800", fontSize: 12 },
    dangerButton: {
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 12,
      backgroundColor: c.dangerSoft,
    },
    dangerText: { color: c.danger, fontWeight: "800", fontSize: 12 },
    leave: {
      minHeight: 48,
      borderWidth: 1,
      borderColor: c.danger,
      borderRadius: 16,
      padding: 13,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    leaveText: { color: c.danger, fontWeight: "800" },
  });
