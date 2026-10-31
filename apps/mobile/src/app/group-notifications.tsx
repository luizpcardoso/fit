import MaterialCommunityIcons from '@/components/icon';
import type { GroupNotification } from "@fit/contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/auth/auth-context";
import { Radius, Type, type AppPalette } from "@/constants/theme";
import { useAppTheme } from "@/theme/theme-provider";
import { ScreenHeader } from "@/components/screen-header";
import { formatRelativeDay, localDate } from "@/utils/dates";

const formatWhen = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${formatRelativeDay(localDate(date))}, ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};

const icons: Record<
  GroupNotification["type"],
  keyof typeof MaterialCommunityIcons.glyphMap
> = {
  invite: "account-plus-outline",
  comment: "comment-outline",
  role_changed: "shield-account-outline",
  removed: "account-remove-outline",
  report_resolved: "flag-checkered",
};
export default function GroupNotifications() {
  const { colors: c } = useAppTheme();
  const s = styles(c);
  const { api } = useAuth();
  const [items, setItems] = useState<GroupNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,setError]=useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      setItems(await api.listGroupNotifications());
    } catch {
      setError('Não foi possível carregar as notificações. Confira sua conexão.');
    } finally {
      setLoading(false);
    }
  }, [api]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const open = async (item: GroupNotification) => {
    if (!item.readAt) void api.readGroupNotification(item.id).catch(()=>setError('Não foi possível marcar a notificação como lida.'));
    if (item.type === "invite" || item.type === 'removed') router.dismissTo("/groups");
    else if (item.groupId)
      router.replace({
        pathname: "/group-detail",
        params: { id: item.groupId },
      });
    else await load();
  };
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <ScreenHeader />
        <View>
          <Text accessibilityRole="header" style={s.title}>Notificações</Text>
          <Text style={s.subtitle}>Convites, comentários e moderação</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        {error?<View accessibilityLiveRegion="polite" style={s.error}><Text accessibilityRole="alert" style={{...Type.label,color:c.danger}}>{error}</Text><Pressable accessibilityRole="button" onPress={() => { setLoading(true); void load(); }} style={{minHeight:44,justifyContent:'center',alignSelf:'flex-start'}}><Text style={{color:c.link,fontWeight:'800'}}>Tentar novamente</Text></Pressable></View>:null}
        {loading ? <ActivityIndicator accessibilityLabel="Carregando notificações" color={c.link} /> : null}
        {!loading && !error && !items.length ? (
          <View style={s.empty}>
            <MaterialCommunityIcons
              name="bell-check-outline"
              size={32}
              color={c.link}
            />
            <Text style={s.emptyTitle}>Tudo em dia</Text>
            <Text style={s.emptyText}>
              Novas interações importantes aparecerão aqui.
            </Text>
          </View>
        ) : (
          items.map((item) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.readAt ? 'Lida' : 'Nova'}: ${item.title}. ${item.message}`}
              key={item.id}
              onPress={() => open(item)}
              style={[s.item, !item.readAt && s.unread]}
            >
              <View style={s.icon}>
                <MaterialCommunityIcons
                  name={icons[item.type]}
                  size={21}
                  color={c.link}
                />
              </View>
              <View style={s.flex}>
                <Text style={[s.itemTitle, !item.readAt && { color: c.notificationText }]}>{!item.readAt ? 'Nova · ' : ''}{item.title}</Text>
                <Text style={s.message}>{item.message}</Text>
                <Text style={s.date}>
                  {formatWhen(item.createdAt)}
                </Text>
              </View>
              {!item.readAt ? <View style={s.dot} /> : null}
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = (c: AppPalette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    header: {
      paddingHorizontal: 18,
      paddingBottom: 14,
      gap: 4,
      maxWidth: 720,
      width: "100%",
      alignSelf: "center",
    },
    error: { backgroundColor: c.dangerSoft, borderRadius: Radius.lg, padding: 12 },
    title: { fontSize: 24, fontWeight: "800", color: c.text },
    subtitle: { fontSize: 12, color: c.textMuted },
    content: {
      padding: 18,
      paddingTop: 0,
      gap: 9,
      maxWidth: 720,
      width: "100%",
      alignSelf: "center",
    },
    item: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      padding: 13,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    unread: { borderColor: c.notificationBorder, backgroundColor: c.notificationBackground },
    icon: {
      width: 42,
      height: 42,
      borderRadius: 16,
      backgroundColor: c.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    flex: { flex: 1 },
    itemTitle: { color: c.text, fontSize: 13, fontWeight: "800" },
    message: { color: c.textMuted, fontSize: 12, lineHeight: 16, marginTop: 2 },
    date: { color: c.textMuted, fontSize: 12, marginTop: 4 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent },
    empty: { padding: 35, alignItems: "center", gap: 8 },
    emptyTitle: { color: c.text, fontSize: 17, fontWeight: "800" },
    emptyText: { color: c.textMuted, fontSize: 12, textAlign: "center" },
  });
