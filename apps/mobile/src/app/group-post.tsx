import { FormScrollView as ScrollView } from '@/components/form-scroll-view';
import { FormInput as TextInput } from '@/components/form-input';
import { useCallback, useState } from "react";
import {prepareMobilePhoto} from '@/utils/mobile-photo';
import MaterialCommunityIcons from '@/components/icon';
import {
  ActivityIndicator,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import type { GroupDetails } from "@fit/contracts";
import { useAuth } from "@/auth/auth-context";
import { useAppTheme } from "@/theme/theme-provider";
import { showToast } from "@/components/app-dialog";
import { ScreenHeader } from "@/components/screen-header";
import { Radius, Type } from "@/constants/theme";
import { useUnsavedChanges } from "@/utils/unsaved-changes";
import { groupErrorMessage } from "@/utils/groups";
export default function GroupPost() {
  const { api } = useAuth();
  const { colors: c } = useAppTheme();
  const [groups, setGroups] = useState<GroupDetails[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const hasDraft = Boolean(text.trim() || photo);
  useUnsavedChanges(hasDraft, "O texto e a foto desta publicação serão descartados.");
  const load = useCallback(async () => {
    try {
      const list = await api.listGroups();
      const details = await Promise.all(list.map((g) => api.getGroup(g.id)));
      setGroups(
        details.filter(
          (g) =>
            g.active &&
            (g.postingMode === "all_members" ||
              g.role === "owner" ||
              g.role === "admin"),
        ),
      );
      setLoadError("");
    } catch (failure) {
      setLoadError(groupErrorMessage(failure, { server: "Não foi possível carregar os grupos. Tente novamente." }));
    } finally {
      setLoading(false);
    }
  }, [api]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const back = () => {
    if (busy) return;
    if (router.canGoBack()) router.back();
    else router.replace("/groups");
  };
  const pick = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Permita o acesso à galeria nas configurações do aparelho para selecionar uma foto.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.85,
        base64: false,
      });
      if (!result.canceled && result.assets[0]) {
        setPhoto((await prepareMobilePhoto(result.assets[0])).dataUrl);
      }
    } catch {
      setError("Não foi possível processar esta foto. Tente outra imagem.");
    }
  };
  const send = async () => {
    if (busy || !selected.length) return;
    setBusy(true);
    setError("");
    try {
      await api.publishToGroups(selected, {
        text: text.trim() || null,
        photoDataUrl: photo,
      });
      const count = selected.length;
      setText("");
      setPhoto(null);
      setSelected([]);
      showToast(count === 1 ? "Publicação enviada para 1 grupo." : `Publicação enviada para ${count} grupos.`);
      router.dismissTo("/groups");
    } catch (failure) {
      setError(groupErrorMessage(failure, {
        forbidden: "Um dos grupos selecionados não permite sua publicação. Nada foi publicado; seu rascunho foi mantido.",
        conflict: "Um dos grupos selecionados não aceita publicações agora. Nada foi publicado; seu rascunho foi mantido.",
        invalid: "A foto é inválida ou excede 10 MB. Seu rascunho foi mantido.",
        network: "Sem conexão. Nada foi publicado e seu rascunho foi mantido.",
      }));
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 20,
          gap: 16,
          paddingBottom: 100,
          maxWidth: 720,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <ScreenHeader backLabel="Grupos" onBack={back} />
        <Text
          accessibilityRole="header"
          style={{ ...Type.headline, fontWeight: "800", color: c.text }}
        >
          Nova publicação
        </Text>
        <Text style={{ color: c.textMuted }}>
          Escreva uma vez e escolha os grupos de destino.
        </Text>
        <TextInput
          editable={!busy}
          accessibilityLabel="Texto da publicação"
          value={text}
          onChangeText={setText}
          multiline
          maxLength={2000}
          placeholder="Compartilhe algo…"
          placeholderTextColor={c.textMuted}
          style={{
            minHeight: 110,
            borderRadius: 16,
            padding: 16,
            backgroundColor: c.surface,
            color: c.text,
            textAlignVertical: "top",
          }}
        />
        {photo ? (
          <>
            <Image
              source={{ uri: photo }}
              style={{ height: 250, borderRadius: 16 }}
              resizeMode="contain"
            />
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => setPhoto(null)} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" }}>
              <MaterialCommunityIcons name="image-remove" size={20} color={c.danger} />
              <Text style={{ ...Type.body, color: c.danger, fontWeight: "700" }}>Remover foto</Text>
            </Pressable>
          </>
        ) : (
          <Pressable accessibilityRole="button"
            disabled={busy}
            onPress={pick}
            style={{
              minHeight: 48,
              padding: 14,
              backgroundColor: c.surface,
              borderRadius: Radius.md,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <MaterialCommunityIcons name="image-plus" size={20} color={c.link} />
            <Text style={{ ...Type.body, color: c.link, fontWeight: "700" }}>Adicionar foto</Text>
          </Pressable>
        )}
        <Text
          style={{
            color: photo ? c.warning : c.textMuted,
            backgroundColor: photo ? c.warningSoft : c.surface,
            padding: 14,
            borderRadius: 12,
          }}
        >
          {photo
            ? "Publicação temporária: o post inteiro, incluindo texto, foto e comentários, expira em 48 horas. A imagem será excluída."
            : "Posts somente de texto não expiram. Ao adicionar uma foto, o post inteiro passa a durar 48 horas."}
        </Text>
        <Text style={{ color: c.text, fontWeight: "800" }}>
          Publicar em ({selected.length})
        </Text>
        {loading ? <ActivityIndicator accessibilityLabel="Carregando grupos" color={c.link} /> : null}
        {loadError ? (
          <View style={{ backgroundColor: c.dangerSoft, borderRadius: Radius.lg, padding: 12 }}>
            <Text accessibilityRole="alert" style={{ color: c.danger }}>{loadError}</Text>
            <Pressable accessibilityRole="button" onPress={() => { setLoading(true); void load(); }} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
              <Text style={{ color: c.link, fontWeight: "800" }}>
                Tentar novamente
              </Text>
            </Pressable>
          </View>
        ) : null}
        {!loading && !groups.length && !loadError ? (
          <Text style={{ color: c.textMuted }}>
            Você ainda não participa de grupos que permitem publicar. Crie um
            grupo ou aceite um convite na aba Grupos.
          </Text>
        ) : null}
        {groups.map((g) => (
          <Pressable
            key={g.id}
            disabled={busy}
            accessibilityRole="checkbox"
            accessibilityLabel={g.name}
            aria-checked={selected.includes(g.id)} aria-disabled={busy}
            onPress={() =>
              setSelected((v) =>
                v.includes(g.id) ? v.filter((id) => id !== g.id) : [...v, g.id],
              )
            }
            style={{
              minHeight: 52,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 14,
              borderRadius: Radius.lg,
              backgroundColor: selected.includes(g.id)
                ? c.primarySoft
                : c.surface,
              borderWidth: 1,
              borderColor: selected.includes(g.id) ? c.primary : c.border,
            }}
          >
            <MaterialCommunityIcons
              name={selected.includes(g.id) ? "checkbox-marked" : "checkbox-blank-outline"}
              size={24}
              color={selected.includes(g.id) ? c.link : c.textMuted}
            />
            <Text style={{ ...Type.body, color: c.text, flex: 1 }}>{g.name}</Text>
          </Pressable>
        ))}
        {error ? <Text accessibilityRole="alert" style={{ ...Type.label, color: c.danger, backgroundColor: c.dangerSoft, padding: 12, borderRadius: Radius.md }}>{error}</Text> : null}
        {!busy && groups.length > 0 && (!selected.length || !hasDraft) ? (
          <Text style={{ ...Type.caption, color: c.textMuted, textAlign: "center" }}>
            {!hasDraft ? "Escreva um texto ou adicione uma foto para publicar." : "Escolha pelo menos um grupo de destino."}
          </Text>
        ) : null}
        <Pressable accessibilityRole="button"
          aria-disabled={busy || !selected.length || !hasDraft} aria-busy={busy}
          disabled={busy || !selected.length || (!text.trim() && !photo)}
          onPress={send}
          style={{
            minHeight: 48,
            justifyContent: "center",
            padding: 16,
            borderRadius: 16,
            backgroundColor: c.primary,
            opacity:
              busy || !selected.length || (!text.trim() && !photo) ? 0.5 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator color={c.white} />
          ) : (
            <Text
              style={{ color: c.white, textAlign: "center", fontWeight: "800" }}
            >
              Publicar nos grupos selecionados
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
