import { FormScrollView as ScrollView } from '@/components/form-scroll-view';
import { FormInput as TextInput } from '@/components/form-input';
import MaterialCommunityIcons from '@/components/icon';
import { ContextHelp } from "@/components/context-help";
import type { GroupInvite, GroupSummary } from "@fit/contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/auth/auth-context";
import { CardShadow, Radius, Scrim, Type, type AppPalette } from "@/constants/theme";
import { useAppTheme } from "@/theme/theme-provider";
import { confirmAction, showToast } from "@/components/app-dialog";
import { groupErrorMessage, roleLabel } from "@/utils/groups";

export default function Groups() {
  const { colors: c } = useAppTheme();
  const s = styles(c);
  const { api } = useAuth();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [deciding, setDeciding] = useState<{ id: string; decision: "accepted" | "declined" } | null>(null);
  const decidingRef = useRef(false);
  const openCreate = () => { setCreateError(""); setShowCreate(true); };
  const closeCreate = () => { if (!saving) setShowCreate(false); };
  const load = useCallback(async () => {
    setError("");
    try {
      const [g, i] = await Promise.all([
        api.listGroups(),
        api.listGroupInvites(),
      ]);
      setGroups(g);
      setInvites(i);
    } catch {
      setError("Não foi possível carregar seus grupos.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const refresh = () => {
    setRefreshing(true);
    void load();
  };
  const create = async () => {
    if (name.trim().length < 2 || saving) return;
    setSaving(true);
    setCreateError("");
    try {
      const created = await api.createGroup({
        name: name.trim(),
        description: description.trim() || null,
      });
      setName("");
      setDescription("");
      setShowCreate(false);
      showToast("Grupo criado.");
      void load();
      router.push({ pathname: "/group-detail", params: { id: created.id } });
    } catch (failure) {
      setCreateError(groupErrorMessage(failure, { invalid: "Confira o nome (mínimo de 2 caracteres) e a descrição.", server: "Não foi possível criar o grupo. Tente novamente." }));
    } finally {
      setSaving(false);
    }
  };
  const decide = async (invite: GroupInvite, decision: "accepted" | "declined") => {
    if (decidingRef.current) return;
    if (decision === "declined") {
      const confirmed = await confirmAction({
        title: `Recusar convite de ${invite.group.name}?`,
        message: "O convite será removido. Para entrar depois, você precisará de um novo convite.",
        confirmLabel: "Recusar convite",
        destructive: true,
      });
      if (!confirmed) return;
    }
    decidingRef.current = true;
    setDeciding({ id: invite.id, decision });
    try {
      await api.decideGroupInvite(invite.id, decision);
      showToast(decision === "accepted" ? `Você entrou em ${invite.group.name}.` : "Convite recusado.");
      await load();
    } catch (failure) {
      showToast(groupErrorMessage(failure, { conflict: "Este convite já foi respondido ou expirou.", not_found: "Este convite não está mais disponível." }), "error");
      void load();
    } finally {
      decidingRef.current = false;
      setDeciding(null);
    }
  };
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={c.primary}
          />
        }
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header}>
          <View style={s.flex}>
            <Text accessibilityRole="header" style={s.title}>
              Grupos
            </Text>
            <Text style={s.subtitle}>
              Compartilhe conquistas com quem treina ao seu lado
            </Text>
          </View>
          <ContextHelp
            title="Como funcionam os grupos"
            paragraphs={[
              "Os grupos são privados. Um convite só dá acesso depois que você aceita na seção Convites recebidos.",
              "Você vê as publicações feitas a partir da sua entrada mais recente no grupo.",
              "Cada grupo aceita determinados eventos. Você escolhe quais compartilhar automaticamente nas preferências de cada grupo. Permissão do administrador não substitui seu consentimento.",
              "Publique texto e uma foto por vez. As conversas acontecem nos comentários; as reações ajudam a incentivar os colegas.",
            ]}
          />
          {groups.length ? (
            <Pressable accessibilityRole="button"
              accessibilityLabel="Criar grupo"
              onPress={openCreate}
              style={s.add}
            >
              <MaterialCommunityIcons name="plus" size={22} color={c.onPrimary} />
            </Pressable>
          ) : null}
        </View>
        {error ? (
          <View style={s.error}>
            <Text style={s.errorText}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => { setLoading(true); void load(); }} style={s.retry}>
              <Text style={s.link}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : null}
        {invites.length ? (
          <View style={s.section}>
            <View style={s.sectionTitle}>
              <Text style={s.heading}>Convites recebidos</Text>
              <Text style={s.count}>{invites.length}</Text>
            </View>
            {invites.map((invite) => (
              <View key={invite.id} style={[s.invite, CardShadow]}>
                <Avatar name={invite.group.name} colors={c} />
                <View style={s.flex}>
                  <Text style={s.cardTitle}>{invite.group.name}</Text>
                  <Text style={s.meta}>
                    {invite.invitedBy.displayName} convidou você
                  </Text>
                  <View style={s.actions}>
                    <Pressable accessibilityRole="button"
                      accessibilityLabel={`Aceitar convite de ${invite.group.name}`}
                      aria-disabled={deciding !== null} aria-busy={deciding?.id === invite.id && deciding.decision === "accepted"}
                      disabled={deciding !== null}
                      onPress={() => void decide(invite, "accepted")}
                      style={[s.accept, deciding !== null && s.disabled]}
                    >
                      {deciding?.id === invite.id && deciding.decision === "accepted" ? <ActivityIndicator color={c.onPrimary} size="small" /> : <Text style={s.acceptText}>Aceitar</Text>}
                    </Pressable>
                    <Pressable accessibilityRole="button"
                      accessibilityLabel={`Recusar convite de ${invite.group.name}`}
                      aria-disabled={deciding !== null} aria-busy={deciding?.id === invite.id && deciding.decision === "declined"}
                      disabled={deciding !== null}
                      onPress={() => void decide(invite, "declined")}
                      style={[s.decline, deciding !== null && s.disabled]}
                    >
                      {deciding?.id === invite.id && deciding.decision === "declined" ? <ActivityIndicator color={c.link} size="small" /> : <Text style={s.declineText}>Recusar</Text>}
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : null}
        <View style={s.sectionTitle}>
          <Text style={s.heading}>Seus grupos</Text>
          {groups.length ? <Text style={s.count}>{groups.length}</Text> : null}
        </View>
        {loading && !groups.length ? (
          <ActivityIndicator color={c.link} size="large" style={s.loading} />
        ) : null}
        {groups.length?<Pressable accessibilityRole="button" accessibilityLabel="Publicar em grupos. Uma publicação, vários grupos" onPress={()=>router.push('/group-post')} style={[s.primary,s.publishRow]}><MaterialCommunityIcons name="pencil-plus-outline" size={22} color={c.onPrimary}/><View style={s.flex}><Text style={s.primaryText}>Publicar em grupos</Text><Text style={s.primarySubtext}>Uma publicação, vários grupos</Text></View></Pressable>:null}
        {!loading && !groups.length && !error ? (
          <View style={[s.empty, CardShadow]}>
            <View style={s.emptyIcon}>
              <MaterialCommunityIcons
                name="account-group-outline"
                size={32}
                color={c.link}
              />
            </View>
            <Text style={s.emptyTitle}>Comece seu primeiro grupo</Text>
            <Text style={s.emptyText}>
              Crie um espaço privado para trocar incentivos, registrar
              conquistas e manter o ritmo em conjunto.
            </Text>
            <Pressable accessibilityRole="button" onPress={openCreate} style={s.primary}>
              <Text style={s.primaryText}>Criar grupo</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={s.grid}>
          {groups.map((group) => (
            <Pressable accessibilityRole="button"
              accessibilityLabel={`${group.name}${group.active ? "" : ", grupo inativo"}${group.unseenCount ? `, ${group.unseenCount} ${group.unseenCount === 1 ? "novidade" : "novidades"}` : ""}`}
              key={group.id}
              onPress={() =>
                router.push({
                  pathname: "/group-detail",
                  params: { id: group.id },
                })
              }
              style={[s.group, CardShadow, !group.active && s.inactive]}
            >
              <View style={s.groupTop}>
                <Avatar name={group.name} colors={c} />
                {!group.active ? (
                  <View style={s.inactiveBadge}>
                    <MaterialCommunityIcons name="pause-circle-outline" size={14} color={c.textMuted} />
                    <Text style={s.inactiveText}>Inativo</Text>
                  </View>
                ) : null}
                {group.unseenCount ? (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>
                      {group.unseenCount > 99 ? "99+" : group.unseenCount}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text numberOfLines={1} style={s.groupTitle}>
                {group.name}
              </Text>
              <Text numberOfLines={2} style={s.groupDescription}>
                {group.description || "Um espaço para evoluir em grupo."}
              </Text>
              <View style={s.groupFooter}>
                <MaterialCommunityIcons
                  name="account-multiple-outline"
                  size={15}
                  color={c.textMuted}
                />
                <Text style={s.meta}>
                  {group.memberCount}{" "}
                  {group.memberCount === 1 ? "membro" : "membros"}
                </Text>
                <View style={s.role}>
                  <Text style={s.roleText}>{roleLabel(group.role)}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <Modal
        visible={showCreate}
        transparent
        animationType="slide"
        onRequestClose={closeCreate}
      >
        <View style={s.overlay}>
          <Pressable accessibilityRole="button" accessibilityLabel="Fechar" style={StyleSheet.absoluteFill} onPress={closeCreate} />
          <ScrollView keyboardLayout="layout" style={s.sheet} contentContainerStyle={s.sheetContent}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <View style={s.flex}>
                <Text accessibilityRole="header" style={s.sheetTitle}>Novo grupo</Text>
                <Text style={s.meta}>Você será o proprietário. O grupo é privado e só entra quem você convidar.</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Fechar criação de grupo" disabled={saving} onPress={closeCreate} style={s.close}>
                <MaterialCommunityIcons name="close" size={21} color={c.text} />
              </Pressable>
            </View>
            <Text style={s.label}>Nome</Text>
            <TextInput
              accessibilityLabel="Nome do grupo"
              value={name}
              onChangeText={setName}
              editable={!saving}
              maxLength={80}
              placeholder="Ex.: Treino das 6h"
              placeholderTextColor={c.textMuted}
              style={s.input}
            />
            <Text style={s.label}>Descrição opcional</Text>
            <TextInput
              accessibilityLabel="Descrição do grupo"
              value={description}
              onChangeText={setDescription}
              editable={!saving}
              maxLength={500}
              multiline
              placeholder="Qual é a proposta do grupo?"
              placeholderTextColor={c.textMuted}
              style={[s.input, s.textarea]}
            />
            {createError ? <Text accessibilityRole="alert" style={s.createError}>{createError}</Text> : null}
            {name.trim().length < 2 ? <Text style={s.meta}>O nome precisa de pelo menos 2 caracteres.</Text> : null}
            <Pressable accessibilityRole="button"
              aria-disabled={saving || name.trim().length < 2} aria-busy={saving}
              disabled={saving || name.trim().length < 2}
              onPress={() => void create()}
              style={[
                s.primary,
                (saving || name.trim().length < 2) && s.disabled,
              ]}
            >
              {saving ? (
                <ActivityIndicator color={c.white} />
              ) : (
                <Text style={s.primaryText}>Criar grupo</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
function Avatar({ name, colors }: { name: string; colors: AppPalette }) {
  return (
    <View
      style={[avatarStyles.avatar, { backgroundColor: colors.primarySoft }]}
    >
      <Text style={[avatarStyles.text, { color: colors.onPrimarySoft }]}>
        {name.trim().slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}
const avatarStyles = StyleSheet.create({
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { fontWeight: "800", fontSize: 15 },
});
const styles = (c: AppPalette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    content: {
      padding: 20,
      paddingBottom: 120,
      gap: 18,
      maxWidth: 720,
      width: "100%",
      alignSelf: "center",
    },
    header: { flexDirection: "row", alignItems: "center", gap: 12 },
    flex: { flex: 1, minWidth: 0 },
    title: {
      fontSize: 30,
      fontWeight: "800",
      letterSpacing: -0.7,
      color: c.text,
    },
    subtitle: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    add: {
      width: 46,
      height: 46,
      borderRadius: 16,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    section: { gap: 10 },
    sectionTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
    heading: { fontSize: 19, fontWeight: "800", color: c.text },
    count: {
      minWidth: 27,
      height: 27,
      lineHeight: 27,
      textAlign: "center",
      paddingHorizontal: 7,
      borderRadius: 16,
      backgroundColor: c.surfaceSoft,
      color: c.textMuted,
      fontWeight: "800",
      fontSize: 12,
    },
    invite: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      padding: 14,
      flexDirection: "row",
      gap: 12,
    },
    cardTitle: { color: c.text, fontSize: 15, fontWeight: "800" },
    meta: { color: c.textMuted, fontSize: 12 },
    actions: { flexDirection: "row", gap: 8, marginTop: 10 },
    accept: {
      minHeight: 44,
      minWidth: 96,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.primary,
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 12,
    },
    acceptText: { color: c.onPrimary, fontWeight: "800", fontSize: 13 },
    decline: {
      minHeight: 44,
      minWidth: 96,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.surfaceSoft,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 12,
    },
    declineText: { color: c.text, fontWeight: "700", fontSize: 13 },
    grid: { gap: 11 },
    group: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 24,
      padding: 16,
      gap: 8,
    },
    inactive: { opacity: 0.85 },
    inactiveBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginLeft: "auto", marginRight: 8, backgroundColor: c.surfaceSoft, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
    inactiveText: { ...Type.caption, color: c.textMuted, fontWeight: "800" },
    retry: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
    publishRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 12 },
    primarySubtext: { ...Type.label, color: c.onPrimary, marginTop: 2 },
    createError: { ...Type.label, color: c.danger, backgroundColor: c.dangerSoft, padding: 10, borderRadius: Radius.md },
    groupTop: { flexDirection: "row", justifyContent: "space-between" },
    badge: {
      minWidth: 27,
      height: 27,
      paddingHorizontal: 7,
      borderRadius: 16,
      backgroundColor: c.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeText: { color: c.white, fontSize: 12, fontWeight: "800" },
    groupTitle: { fontSize: 18, fontWeight: "800", color: c.text },
    groupDescription: { fontSize: 12, lineHeight: 18, color: c.textMuted },
    groupFooter: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginTop: 2,
    },
    role: {
      marginLeft: "auto",
      backgroundColor: c.primarySoft,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    roleText: { color: c.onPrimarySoft, fontSize: 12, fontWeight: "800" },
    empty: {
      alignItems: "center",
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 24,
      padding: 26,
      gap: 10,
    },
    emptyIcon: {
      width: 65,
      height: 65,
      borderRadius: 24,
      backgroundColor: c.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyTitle: { fontSize: 19, fontWeight: "800", color: c.text },
    emptyText: {
      fontSize: 13,
      lineHeight: 20,
      color: c.textMuted,
      textAlign: "center",
      maxWidth: 380,
    },
    primary: {
      backgroundColor: c.primary,
      borderRadius: 16,
      paddingHorizontal: 20,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryText: { color: c.onPrimary, fontWeight: "800" },
    loading: { paddingVertical: 30 },
    error: {
      backgroundColor: c.dangerSoft,
      padding: 14,
      borderRadius: 16,
      gap: 5,
    },
    errorText: { color: c.danger },
    link: { color: c.link, fontWeight: "800" },
    overlay: {
      flex: 1,
      backgroundColor: Scrim,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      maxHeight: '90%',
      flexGrow: 0,
    },
    sheetContent: { padding: 22, paddingBottom: 34, gap: 10 },
    sheetHandle: {
      width: 44,
      height: 4,
      borderRadius: 4,
      backgroundColor: c.border,
      alignSelf: "center",
      marginBottom: 4,
    },
    sheetHeader: {
      gap: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 5,
    },
    sheetTitle: { fontSize: 22, fontWeight: "800", color: c.text },
    close: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: c.surfaceSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    label: { fontSize: 12, fontWeight: "800", color: c.text },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.background,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 13,
      color: c.text,
      fontSize: 14,
    },
    textarea: { height: 90, textAlignVertical: "top" },
    disabled: { opacity: 0.45 },
  });
