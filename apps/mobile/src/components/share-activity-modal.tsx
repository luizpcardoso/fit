import MaterialCommunityIcons from '@/components/icon';
import type { GroupDetails } from "@fit/contracts";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/auth/auth-context";
import { Radius, Scrim, type AppPalette } from "@/constants/theme";
import { useAppTheme } from "@/theme/theme-provider";
import { showToast } from "@/components/app-dialog";
import { groupErrorMessage } from "@/utils/groups";

type Activity = {
  eventType:
    "workout_completed" | "cardio_completed" | "weekly_goal" | "weekly_streak";
  sourceType: "workout_session" | "cardio_session" | "weekly_goal";
  sourceId: string;
};
export function ShareActivityModal({ activity, onClose }: { activity: Activity | null; onClose(): void }) {
  // Unmount the content before clearing the activity; hidden native modals still render children.
  return activity ? <ShareActivityContent key={`${activity.eventType}:${activity.sourceId}`} activity={activity} onClose={onClose} /> : null;
}
function ShareActivityContent({ activity, onClose }: { activity: Activity; onClose(): void }) {
  const { colors: c } = useAppTheme();
  const s = styles(c);
  const { api } = useAuth();
  const [groups, setGroups] = useState<GroupDetails[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberOfAny, setMemberOfAny] = useState(true);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const close = () => { if (!inFlight.current) onClose(); };
  useEffect(() => {
    if (!activity) return;
    let active = true;
    void Promise.resolve().then(()=>{if(active){setLoading(true);setGroups([]);setSelected([]);setError('');}});
    api
      .listGroups()
      .then((items) => Promise.all(items.map((item) => api.getGroup(item.id))))
      .then((details) => {
        if (!active) return;
        const eligible = details.filter(
          (group) => group.eventSettings?.[activity.eventType],
        );
        setGroups(eligible);
        setMemberOfAny(details.length > 0);
        setSelected([]); // Sharing requires an explicit choice for this activity.
      })
      .catch(() => { if (active) setError('Não foi possível carregar os grupos. Sua atividade está salva. Tente novamente.'); })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activity, api, attempt]);
  const share = async () => {
    if (inFlight.current || !selected.length || loading) return;
    inFlight.current = true; setSaving(true); setError('');
    try {
      if (selected.length)
        await api.shareGroupActivity(
          selected,
          activity.eventType,
          activity.sourceType,
          activity.sourceId,
        );
      const count = selected.length;
      if (mounted.current) onClose();
      showToast(count === 1 ? 'Conquista compartilhada em 1 grupo.' : `Conquista compartilhada em ${count} grupos.`);
    } catch (failure) {
      if (mounted.current) setError(groupErrorMessage(failure, {
        forbidden: 'Um dos grupos não aceita mais este tipo de atividade. Nada foi compartilhado; sua atividade continua salva.',
        conflict: 'Um dos grupos não aceita mais este tipo de atividade. Nada foi compartilhado; sua atividade continua salva.',
        network: 'Compartilhamento não enviado. Sua atividade continua salva. Confira a conexão e tente novamente.',
        server: 'Compartilhamento não enviado. Sua atividade continua salva. Tente novamente em instantes.',
      }));
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  return (
    <Modal
      visible={Boolean(activity)}
      transparent
      animationType="slide"
      onRequestClose={close}
    >
      <View style={s.overlay}>
        <SafeAreaView style={s.sheet} edges={["bottom"]} accessibilityViewIsModal>
          <View style={s.handle} />
          <View style={s.header}>
            <View style={s.icon}>
              <MaterialCommunityIcons
                name="share-variant-outline"
                size={23}
                color={c.link}
              />
            </View>
            <View style={s.flex}>
              <Text accessibilityRole="header" style={s.title}>Compartilhar conquista?</Text>
              <Text style={s.subtitle}>
                Escolha em quais grupos esta atividade pode aparecer.
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar compartilhamento" onPress={close} style={s.close}>
              <MaterialCommunityIcons
                name="close"
                size={21}
                color={c.textMuted}
              />
            </Pressable>
          </View>
          {error ? <View accessibilityRole="alert" style={s.errorBox}><Text style={{ color: c.danger }}>{error}</Text><Pressable accessibilityRole="button" disabled={saving} onPress={() => setAttempt(value => value + 1)} style={s.reload}><Text style={s.reloadText}>Recarregar grupos</Text></Pressable></View> : null}
          <ScrollView contentContainerStyle={{ gap: 10 }}>
          {loading ? (
            <ActivityIndicator accessibilityLabel="Carregando grupos" color={c.link} />
          ) : groups.length ? (
            groups.map((group) => {
              const chosen = selected.includes(group.id);
              const automatic =
                group.sharePreferences?.[
                  activity.eventType as keyof typeof group.sharePreferences
                ];
              return (
                <Pressable
                  key={group.id}
                  accessibilityRole="checkbox"
                  aria-checked={chosen}
                  aria-disabled={saving}
                  disabled={saving}
                  onPress={() =>
                    setSelected((value) =>
                      chosen
                        ? value.filter((id) => id !== group.id)
                        : [...value, group.id],
                    )
                  }
                  style={[s.group, chosen && s.groupSelected]}
                >
                  <View style={[s.check, chosen && s.checkActive]}>
                    {chosen ? (
                      <MaterialCommunityIcons
                        name="check"
                        size={16}
                        color={c.onPrimary}
                      />
                    ) : null}
                  </View>
                  <View style={s.flex}>
                    <Text style={s.groupName}>{group.name}</Text>
                    <Text style={s.groupMeta}>
                      {automatic
                        ? "Compartilhamento automático ativo"
                        : "Somente desta vez"}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>{memberOfAny ? "Nenhum grupo disponível" : "Você ainda não participa de grupos"}</Text>
              <Text style={s.emptyText}>
                {memberOfAny
                  ? "Os administradores dos seus grupos ainda não habilitaram este tipo de atividade."
                  : "Crie um grupo ou aceite um convite na aba Grupos para compartilhar conquistas. Sua atividade já está salva."}
              </Text>
            </View>
          )}
          </ScrollView>
          <View style={s.actions}>
            <Pressable accessibilityRole="button" onPress={close} style={s.later}>
              <Text style={s.laterText}>{groups.length ? "Não compartilhar" : "Fechar"}</Text>
            </Pressable>
            {loading || groups.length ? <Pressable
              accessibilityRole="button"
              aria-disabled={saving || loading || !selected.length}
              disabled={saving || loading || !selected.length}
              onPress={share}
              style={[s.share, (saving || !selected.length) && s.disabled]}
            >
              {saving ? (
                <ActivityIndicator color={c.onPrimary} />
              ) : (
                <Text style={s.shareText}>Compartilhar</Text>
              )}
            </Pressable> : null}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
const styles = (c: AppPalette) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: Scrim,
      justifyContent: "flex-end",
    },
    sheet: {
      maxHeight: "90%",
      width: "100%", maxWidth: 680, alignSelf: "center",
      backgroundColor: c.surface,
      borderTopLeftRadius: 27,
      borderTopRightRadius: 27,
      padding: 20,
      gap: 10,
    },
    handle: {
      width: 42,
      height: 4,
      borderRadius: 3,
      backgroundColor: c.border,
      alignSelf: "center",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      marginBottom: 6,
    },
    icon: {
      width: 45,
      height: 45,
      borderRadius: 16,
      backgroundColor: c.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    flex: { flex: 1 },
    close: { width: 44, height: 44, borderRadius: Radius.md, alignItems: "center", justifyContent: "center", backgroundColor: c.surfaceSoft },
    errorBox: { backgroundColor: c.dangerSoft, borderRadius: Radius.md, padding: 12, gap: 4 },
    reload: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
    reloadText: { color: c.link, fontWeight: "800" },
    title: { fontSize: 19, fontWeight: "800", color: c.text },
    subtitle: {
      fontSize: 12,
      lineHeight: 16,
      color: c.textMuted,
      marginTop: 2,
    },
    group: {
      minHeight: 56,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    groupSelected: { borderColor: c.primary, backgroundColor: c.primarySoft },
    check: {
      width: 25,
      height: 25,
      borderRadius: Radius.sm,
      borderWidth: 2,
      borderColor: c.fieldBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    checkActive: { backgroundColor: c.primary, borderColor: c.primary },
    groupName: { color: c.text, fontSize: 13, fontWeight: "800" },
    groupMeta: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    empty: { padding: 18, alignItems: "center", gap: 5 },
    emptyTitle: { color: c.text, fontWeight: "800" },
    emptyText: {
      color: c.textMuted,
      fontSize: 12,
      textAlign: "center",
      lineHeight: 16,
    },
    actions: { flexDirection: "row", gap: 9, marginTop: 8 },
    later: {
      flex: 1,
      minHeight: 48,
      justifyContent: "center",
      padding: 14,
      borderRadius: 16,
      backgroundColor: c.surfaceSoft,
      alignItems: "center",
    },
    laterText: { color: c.text, fontWeight: "800", fontSize: 13 },
    share: {
      flex: 1,
      minHeight: 48,
      justifyContent: "center",
      padding: 14,
      borderRadius: 16,
      backgroundColor: c.primary,
      alignItems: "center",
    },
    shareText: { color: c.onPrimary, fontWeight: "800", fontSize: 13 },
    disabled: { opacity: 0.4 },
  });
