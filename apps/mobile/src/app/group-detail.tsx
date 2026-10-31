import { FormKeyboardAvoidingView } from '@/components/form-keyboard-avoiding-view';
import { FormScrollView as ScrollView } from '@/components/form-scroll-view';
import { FormInput as TextInput } from '@/components/form-input';
import MaterialCommunityIcons from '@/components/icon';
import { ApiClientError } from "@fit/api-client";
import type {
  GroupComment,
  GroupDetails,
  GroupPost,
  GroupReaction,
} from "@fit/contracts";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Image,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/auth/auth-context";
import { CardShadow, Radius, Scrim, Type, type AppPalette } from "@/constants/theme";
import { useAppTheme } from "@/theme/theme-provider";
import { confirmAction, showDialog, showToast } from "@/components/app-dialog";
import { ScreenHeader } from "@/components/screen-header";
import { ReportContentSheet, type ReportTarget } from "@/components/report-content-sheet";
import { groupErrorMessage } from "@/utils/groups";
import {Image as CachedImage} from 'expo-image';
import {prepareMobilePhoto} from '@/utils/mobile-photo';
import { formatRelativeDay, localDate } from '@/utils/dates';

const reactions: { key: GroupReaction; emoji: string; label: string }[] = [
  { key: "like", emoji: "👍", label: "Curtir" },
  { key: "love", emoji: "❤️", label: "Amei" },
  { key: "strength", emoji: "💪", label: "Força" },
  { key: "fire", emoji: "🔥", label: "Mandou bem" },
  { key: "applause", emoji: "👏", label: "Parabéns" },
];
const eventIcons: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> =
  {
    workout_completed: "dumbbell",
    cardio_completed: "heart-pulse",
    weekly_goal: "target",
    weekly_streak: "fire",
    member_joined: "account-plus",
  };
/** Timestamps from the API are instants; show the local day ("Hoje", "Ontem", "sex., 30 de out.") plus the time. */
const formatTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${formatRelativeDay(localDate(date))}, ${time}`;
};

const postKindLabel = (kind: GroupPost["kind"]) =>
  kind === "event" ? "Conquista" : kind === "announcement" ? "Aviso" : null;

function expiryLabel(createdAt:string) {
  const remaining=new Date(createdAt).getTime()+48*60*60*1000-Date.now();
  if(remaining<=0)return 'Expirado';
  const hours=Math.ceil(remaining/3_600_000);
  return hours===1?'Expira em menos de 1 hora':`Expira em ${hours} horas`;
}

export default function GroupDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors: c } = useAppTheme();
  const s = styles(c);
  const { api, user } = useAuth();
  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [nextCursor,setNextCursor]=useState<string|null>(null);
  const [loadingMore,setLoadingMore]=useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState("jpeg");
  const [publishing, setPublishing] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [publishError, setPublishError] = useState("");
  const publishLock = useRef(false);
  const feed = useRef<FlatList<GroupPost>>(null);
  const insets = useSafeAreaInsets();
  const [controlsVisible, setControlsVisible] = useState(true);
  const [showTop, setShowTop] = useState(false);
  const [dockProgress] = useState(() => new Animated.Value(0));
  const scrollingToTop = useRef(false);
  const scrollPosition = useRef(0);
  const scrollTravel = useRef(0);
  useEffect(() => {
    const animation = Animated.timing(dockProgress, { toValue: controlsVisible ? 0 : 1, duration: 180, useNativeDriver: Platform.OS !== 'web', isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [controlsVisible, dockProgress]);
  const goToTop = () => {
    scrollingToTop.current = scrollPosition.current > 8;
    feed.current?.scrollToOffset({ offset: 0, animated: true });
    scrollPosition.current = 0;
    scrollTravel.current = 0;
    setShowTop(false);
    setControlsVisible(true);
  };
  const onFeedScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const y = Math.max(0, Math.min(contentOffset.y, Math.max(0, contentSize.height - layoutMeasurement.height)));
    if (scrollingToTop.current && y > 8) return;
    scrollingToTop.current = false;
    const delta = y - scrollPosition.current;
    scrollPosition.current = y;
    if (y <= 8) { scrollTravel.current = 0; setControlsVisible(true); setShowTop(false); return; }
    if (delta === 0) return;
    scrollTravel.current = Math.sign(delta) === Math.sign(scrollTravel.current) ? scrollTravel.current + delta : delta;
    if (Math.abs(scrollTravel.current) < 24) return;
    const upward = scrollTravel.current < 0;
    setControlsVisible(upward);
    setShowTop(upward && y > 240);
    scrollTravel.current = 0;
  };
  const [commentsPost, setCommentsPost] = useState<GroupPost | null>(null);
  const [actionPost, setActionPost] = useState<GroupPost | null>(null);
  const load = useCallback(async () => {
    if (!id) return;
    setError("");
    try {
      const [g, f] = await Promise.all([
        api.getGroup(id),
        api.listGroupPosts(id),
      ]);
      setGroup(g);
      setPosts(f.items);
      setNextCursor(f.nextCursor);
      void api
        .markGroupSeen(id)
        .catch((markError) =>
          console.warn(
            "Não foi possível marcar o grupo como visto.",
            markError,
          ),
        );
    } catch (loadError) {
      console.error("Falha ao abrir grupo.", loadError);
      setError(
        loadError instanceof ApiClientError
          ? loadError.details.message
          : "Não foi possível abrir este grupo.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api, id]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const refresh = () => {
    setRefreshing(true);
    void load();
  };
  const loadMore=async()=>{if(!id||!nextCursor||loadingMore||loading||refreshing)return;setLoadingMore(true);try{const page=await api.listGroupPosts(id,nextCursor);setPosts(current=>[...current,...page.items.filter(p=>!current.some(existing=>existing.id===p.id))]);setNextCursor(page.nextCursor)}catch{setError('Não foi possível carregar mais publicações. Tente novamente.')}finally{setLoadingMore(false)}};
  const pickPhoto = async () => {
    try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPublishError("Permita o acesso à galeria para publicar uma foto.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.72,
      base64: false,
    });
    if (!result.canceled && result.assets[0]) {
      try{const prepared=await prepareMobilePhoto(result.assets[0]);setPhoto(prepared.base64);setPhotoMime('jpeg');}catch{setPublishError('Não foi possível processar esta foto. Tente outra imagem.');}
    }
    } catch {
      setPublishError("Não foi possível abrir a galeria. Tente novamente.");
    }
  };
  const publish = async () => {
    if (!id || publishLock.current || (!text.trim() && !photo)) return;
    publishLock.current = true;
    setPublishError("");
    setPublishing(true);
    try {
      await api.createGroupPost(id, {
        text: text.trim() || null,
        photoDataUrl: photo ? `data:image/${photoMime};base64,${photo}` : null,
      });
      setText("");
      setPhoto(null);
      setComposerOpen(false);
      goToTop();
      await load();
    } catch {
      setPublishError("Não foi possível publicar. Confira sua conexão e tente novamente. Seu rascunho foi mantido.");
    } finally {
      publishLock.current = false;
      setPublishing(false);
    }
  };
  const react = async (post: GroupPost, reaction: GroupReaction) => {
    if (!id) return;
    try {
      const current = post.reactionCounts.find(
        (item) => item.reactedByMe,
      )?.reaction;
      await api.reactToGroupPost(
        id,
        post.id,
        current === reaction ? null : reaction,
      );
      await load();
    } catch (failure) {
      showToast(groupErrorMessage(failure, { network: "Reação não enviada. Confira sua conexão e tente novamente." }), "error");
    }
  };
  const removePost = async () => {
    const post = actionPost;
    if (!id || !post) return;
    setActionPost(null);
    const own = post.author.id === user?.id;
    const confirmed = await confirmAction({
      title: "Remover publicação?",
      message: own
        ? "A publicação, as reações e os comentários deixarão de aparecer para os membros do grupo. Essa ação não pode ser desfeita."
        : `A publicação de ${post.author.displayName} deixará de aparecer para os membros do grupo. Essa ação não pode ser desfeita.`,
      confirmLabel: "Remover publicação",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await api.deleteGroupPost(id, post.id);
      setPosts(current => current.filter(item => item.id !== post.id));
      showToast("Publicação removida.");
      void load();
    } catch (failure) {
      showToast(groupErrorMessage(failure, { forbidden: "Você não tem permissão para remover esta publicação.", not_found: "Esta publicação já foi removida." }), "error");
    }
  };
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const report = () => {
    if (!actionPost) return;
    setReportTarget({ type: "post", id: actionPost.id });
    setActionPost(null);
  };
  const hideAuthor = async () => {
    const post = actionPost;
    if (!post) return;
    setActionPost(null);
    const name = post.author.displayName;
    const confirmed = await confirmAction({
      title: `Ocultar ${name}?`,
      message: `Você deixará de ver as publicações de ${name} em todos os grupos. A pessoa não é avisada e continua no grupo. Você poderá desfazer logo em seguida.`,
      confirmLabel: "Ocultar usuário",
    });
    if (!confirmed) return;
    try {
      await api.setUserBlocked(post.author.id, true);
      await load();
      showDialog("Usuário ocultado", `As publicações de ${name} não aparecerão mais para você.`, [
        { text: "Entendi", style: "cancel" },
        { text: "Desfazer", onPress: async () => { await api.setUserBlocked(post.author.id, false); await load(); showToast(`As publicações de ${name} voltaram a aparecer.`); } },
      ]);
    } catch (failure) {
      showToast(groupErrorMessage(failure, { conflict: "Não foi possível ocultar este usuário." }), "error");
    }
  };
  const canPost =
    group &&
    (group.postingMode === "all_members" ||
      group.role === "owner" ||
      group.role === "admin");

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.topBar}>
        <ScreenHeader backLabel="Grupos" onBack={() => router.canGoBack() ? router.back() : router.replace('/groups')} right={group ? <Pressable accessibilityRole="button" accessibilityLabel="Configurações do grupo" hitSlop={4} onPress={() => router.push({pathname:'/group-manage',params:{id:group.id,section:'feed'}})} style={s.headerIcon}><MaterialCommunityIcons name="tune-variant" size={22} color={c.link}/></Pressable> : null}/>
        <Text numberOfLines={1} accessibilityRole="header" style={s.title}>{group?.name || 'Grupo'}</Text>
        <Text style={s.headerMeta}>{group ? `${group.memberCount} ${group.memberCount === 1 ? 'membro' : 'membros'} · Mais recentes${group.active ? '' : ' · Grupo inativo'}` : 'Carregando…'}</Text>
      </View>
      <View style={{ flex: 1 }}>
      <FlatList
        ref={feed}
        accessibilityLabel="Feed do grupo"
        style={{ flex: 1 }}
        onScroll={onFeedScroll}
        onScrollBeginDrag={() => { scrollingToTop.current = false; }}
        scrollEventThrottle={16}
        data={posts}
        keyExtractor={post=>post.id}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        onEndReached={()=>void loadMore()}
        onEndReachedThreshold={0.4}
        ListFooterComponent={loadingMore?<ActivityIndicator color={c.link}/>:nextCursor?<Pressable accessibilityRole="button" onPress={loadMore} style={{padding:16,minHeight:44}}><Text style={{color:c.link,textAlign:'center'}}>Carregar mais</Text></Pressable>:<></>}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={c.primary}
          />
        }
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={error ? <View style={s.error}>
          <Text accessibilityRole="alert" style={s.errorText}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={load} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={s.link}>Tentar novamente</Text></Pressable>
        </View> : undefined}
        ListEmptyComponent={loading ? <ActivityIndicator accessibilityLabel="Carregando publicações" color={c.link} size="large" style={s.loading}/> : !error ? <View style={s.empty}>
          <MaterialCommunityIcons name="post-outline" size={30} color={c.link}/>
          <Text style={s.emptyTitle}>O feed está tranquilo</Text>
          <Text style={s.emptyText}>{canPost ? 'Compartilhe a primeira publicação pelo menu inferior.' : 'As próximas publicações e conquistas aparecerão aqui.'}</Text>
        </View> : undefined}
        renderItem={({item:post}) => (
          <View key={post.id} style={[s.post, CardShadow]}>
            <View style={s.postHeader}>
              <View
                style={[s.userAvatar, post.kind === "event" && s.eventAvatar]}
              >
                {post.kind === "event" ? (
                  <MaterialCommunityIcons
                    name={eventIcons[post.eventType || ""] || "star-outline"}
                    size={20}
                    color={c.link}
                  />
                ) : (
                  <Text style={s.userInitial}>
                    {post.author.displayName.slice(0, 1).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={s.flex}>
                <View style={s.authorRow}>
                  <Text numberOfLines={1} style={s.author}>
                    {post.author.displayName}
                  </Text>
                  {postKindLabel(post.kind) ? (
                    <View style={s.postKindBadge}>
                      <Text style={s.postKindText}>
                        {postKindLabel(post.kind)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={s.time}>{formatTime(post.createdAt)}{post.edited ? " · editado" : ""}</Text>
              </View>
              <Pressable accessibilityRole="button"
                accessibilityLabel={`Ações da publicação de ${post.author.displayName}`}
                onPress={() => setActionPost(post)}
                style={s.moreButton}
              >
                <MaterialCommunityIcons
                  name="dots-horizontal"
                  size={22}
                  color={c.textMuted}
                />
              </Pressable>
            </View>
            {post.text ? (
              <Text style={[s.postText, post.kind === "event" && s.eventText]}>
                {post.text}
              </Text>
            ) : null}
            {post.photoUrl ? (
              <View style={s.postPhotoWrap}>
                <PostPhoto groupId={id!} postId={post.id} />
                <View style={s.expiryBadge}>
                  <MaterialCommunityIcons
                    name="timer-sand"
                    size={13}
                    color={c.white}
                  />
                  <Text style={s.expiryText}>{expiryLabel(post.createdAt)}</Text>
                </View>
              </View>
            ) : null}
            {post.reactionCounts.length || post.commentCount ? (
              <View style={s.engagementSummary}>
                <Text style={s.reactionTotal}>
                  {post.reactionCounts
                    .map(
                      (item) =>
                        reactions.find((reaction) => reaction.key === item.reaction)
                          ?.emoji,
                    )
                    .join("")}{" "}
                  {post.reactionCounts.reduce((total, item) => total + item.count, 0) || ""}
                </Text>
                {post.commentCount ? (
                  <Text style={s.commentTotal}>
                    {post.commentCount} {post.commentCount === 1 ? "comentário" : "comentários"}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <View style={s.postActions}>
              <ScrollView automaticallyAdjustKeyboardInsets={false}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.reactions}
              >
                {reactions.map((reaction) => {
                  const selected = post.reactionCounts.some(
                    (item) =>
                      item.reaction === reaction.key && item.reactedByMe,
                  );
                  return (
                    <Pressable
                      accessibilityLabel={`Reagir: ${reaction.label}`}
                      accessibilityRole="button"
                      aria-selected={selected}
                      key={reaction.key}
                      onPress={() => react(post, reaction.key)}
                      style={[s.reaction, selected && s.reactionSelected]}
                    >
                      <Text style={s.emoji}>{reaction.emoji}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Pressable accessibilityRole="button"
                accessibilityLabel={post.commentsEnabled ? `Comentar${post.commentCount ? ` (${post.commentCount} ${post.commentCount === 1 ? "comentário" : "comentários"})` : ""}` : "Comentários desativados nesta publicação"}
                aria-disabled={!post.commentsEnabled}
                disabled={!post.commentsEnabled}
                onPress={() => setCommentsPost(post)}
                style={s.commentButton}
              >
                <MaterialCommunityIcons
                  name="comment-outline"
                  size={19}
                  color={post.commentsEnabled ? c.link : c.textMuted}
                />
                <Text style={[s.commentText, !post.commentsEnabled && { color: c.textMuted }]}>
                  {post.commentsEnabled ? "Comentar" : "Sem comentários"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      />
      {showTop ? <View pointerEvents="box-none" style={s.topShortcut}><Pressable accessibilityRole="button" accessibilityLabel="Ir para o topo do feed" onPress={goToTop} style={[s.topShortcutButton, CardShadow]}><MaterialCommunityIcons name="arrow-up" size={18} color={c.white}/><Text style={s.publishText}>Ir para o topo</Text></Pressable></View> : null}
      {group ? <Animated.View pointerEvents={controlsVisible ? 'auto' : 'none'} aria-hidden={!controlsVisible} accessibilityElementsHidden={!controlsVisible} importantForAccessibility={controlsVisible ? 'auto' : 'no-hide-descendants'} style={[s.dock, { paddingBottom: Math.max(insets.bottom, 12), opacity: dockProgress.interpolate({inputRange:[0,1],outputRange:[1,0]}), transform:[{translateY:dockProgress.interpolate({inputRange:[0,1],outputRange:[0,130+insets.bottom]})}] }]}>
        {canPost ? <View style={s.dockActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Escrever publicação" onPress={() => {setPublishError('');setComposerOpen(true);}} style={s.dockWrite}><MaterialCommunityIcons name="pencil-outline" size={20} color={c.white}/><Text style={s.dockWriteText}>{text.trim() || photo ? 'Continuar rascunho' : 'Publicar no grupo'}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Publicar foto" onPress={() => {setPublishError('');setComposerOpen(true);void pickPhoto();}} style={s.dockPhoto}><MaterialCommunityIcons name="image-outline" size={22} color={c.link}/><Text style={s.photoText}>Foto</Text></Pressable>
        </View> : <Text style={s.restrictedText}>Somente administradores podem publicar. Você pode acompanhar e reagir.</Text>}
      </Animated.View> : null}
      </View>
      <Modal visible={composerOpen} transparent animationType="slide" onRequestClose={() => {if (!publishLock.current) setComposerOpen(false);}}>
        <View style={s.composerOverlay}>
          <SafeAreaView edges={['bottom']} style={s.composerSheet}>
            <View style={s.composerHeading}><Text accessibilityRole="header" style={s.commentsTitle}>Nova publicação</Text><Pressable accessibilityRole="button" accessibilityLabel="Fechar editor de publicação" disabled={publishing} onPress={() => setComposerOpen(false)} style={s.iconButton}><MaterialCommunityIcons name="close" size={22} color={c.text}/></Pressable></View>
            <Text style={s.composerGroup}>{group?.name} · Apenas membros do grupo</Text>
            <ScrollView keyboardLayout="layout" contentContainerStyle={{padding:16}}>
<View
            style={s.composer}
          >
            <View style={s.composerRow}>
              <View style={s.userAvatar}>
                <Text style={s.userInitial}>
                  {(user?.displayName || user?.firstName || "U")
                    .slice(0, 1)
                    .toUpperCase()}
                </Text>
              </View>
              <TextInput
                value={text}
                onChangeText={setText}
                multiline
                maxLength={2000}
                placeholder="Compartilhe uma conquista..."
                placeholderTextColor={c.textMuted}
                accessibilityLabel="Texto da publicação"
                editable={!publishing}
                style={[s.composerInput, s.composerInputExpanded]}
              />
            </View>
            {photo ? (
              <View style={s.photoPreview}>
                <Image
                  source={{ uri: `data:image/${photoMime};base64,${photo}` }}
                  style={s.previewImage}
                />
                <Pressable accessibilityRole="button" accessibilityLabel="Remover foto do rascunho" disabled={publishing} onPress={() => setPhoto(null)} style={s.removePhoto}>
                  <MaterialCommunityIcons
                    name="close"
                    size={18}
                    color={c.white}
                  />
                </Pressable>
              </View>
            ) : null}
            {photo ? (
              <View style={s.temporaryNote}>
                <MaterialCommunityIcons
                  name="timer-sand"
                  size={15}
                  color={c.warning}
                />
                <Text style={s.temporaryNoteText}>
                  Publicações com foto ficam disponíveis por 48 horas.
                </Text>
              </View>
            ) : null}
            {publishError ? <Text accessibilityRole="alert" style={s.errorText}>{publishError}</Text> : null}
            <View style={s.composerFooter}>
              <Pressable accessibilityRole="button" disabled={publishing} onPress={pickPhoto} style={s.photoButton}>
                <MaterialCommunityIcons
                  name="image-outline"
                  size={20}
                  color={c.link}
                />
                <Text style={s.photoText}>
                  {photo ? "Trocar foto" : "Adicionar foto"}
                </Text>
              </Pressable>
              <Text style={s.characters}>{text.length}/2000</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Publicar no grupo"
                disabled={publishing || (!text.trim() && !photo)}
                onPress={publish}
                style={[
                  s.publish,
                  (publishing || (!text.trim() && !photo)) && s.disabled,
                ]}
              >
                {publishing ? (
                  <ActivityIndicator color={c.white} size="small" />
                ) : (
                  <>
                    <Text style={s.publishText}>Publicar</Text>
                    <MaterialCommunityIcons
                      name="send"
                      size={16}
                      color={c.white}
                    />
                  </>
                )}
              </Pressable>
            </View>
          </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
      <CommentsModal
        key={commentsPost?.id ?? "closed"}
        visiblePost={commentsPost}
        groupId={id!}
        onClose={() => setCommentsPost(null)}
        onChanged={load}
      />
      <Modal
        visible={Boolean(actionPost)}
        transparent
        animationType="fade"
        onRequestClose={() => setActionPost(null)}
      >
        <View style={s.actionOverlay}>
          <Pressable accessibilityRole="button" accessibilityLabel="Fechar" style={StyleSheet.absoluteFill} onPress={() => setActionPost(null)} />
          <View style={s.actionSheet}>
            <Text accessibilityRole="header" style={s.actionTitle}>Publicação</Text>
            {actionPost?.author.id === user?.id ||
            group?.role === "owner" ||
            group?.role === "admin" ||
            group?.role === "moderator" ? (
              <Pressable accessibilityRole="button" onPress={() => void removePost()} style={s.actionRow}>
                <MaterialCommunityIcons
                  name="trash-can-outline"
                  size={21}
                  color={c.danger}
                />
                <Text style={[s.actionText, { color: c.danger }]}>
                  Remover publicação
                </Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" onPress={report} style={s.actionRow}>
              <MaterialCommunityIcons
                name="flag-outline"
                size={21}
                color={c.text}
              />
              <Text style={s.actionText}>Denunciar publicação</Text>
            </Pressable>
            {actionPost?.author.id !== user?.id ? (
              <Pressable accessibilityRole="button"
                onPress={() => void hideAuthor()}
                style={s.actionRow}
              >
                <MaterialCommunityIcons
                  name="account-cancel-outline"
                  size={21}
                  color={c.text}
                />
                <Text style={s.actionText}>Ocultar publicações de {actionPost?.author.displayName}</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" onPress={() => setActionPost(null)} style={[s.actionRow, s.actionCancel]}>
              <Text style={[s.actionText, { color: c.link }]}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <ReportContentSheet groupId={id!} target={reportTarget} onClose={() => setReportTarget(null)} />
    </SafeAreaView>
  );
}

function PostPhoto({ groupId, postId }: { groupId: string; postId: string }) {
  const { api } = useAuth();
  const { colors: c } = useAppTheme();
  const [source, setSource] = useState<{ uri: string;headers?:{authorization?:string};cacheKey?:string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    api
      .getGroupPhotoSource(groupId, postId)
      .then((value) => {
        if (active) setSource(value);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [api, groupId, postId, attempt]);
  if (failed)
    return (
      <View
        style={{
          height: 180,
          padding: 20,
          gap: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: c.surfaceSoft,
        }}
      >
        <MaterialCommunityIcons
          name="image-off-outline"
          size={28}
          color={c.textMuted}
        />
        <Text style={{ color: c.textMuted }}>
          A foto não carregou ou a publicação expirou.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setFailed(false);
            setSource(null);
            setAttempt((v) => v + 1);
          }}
          style={{ padding: 12 }}
        >
          <Text style={{ color: c.link }}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  return source ? (
    <CachedImage
      source={source}
      onError={() => setFailed(true)}
      contentFit="contain"
      cachePolicy="disk"
      recyclingKey={postId}
      accessibilityLabel="Foto da publicação"
      style={{ width: "100%", aspectRatio: 1, backgroundColor: c.surfaceSoft }}
    />
  ) : (
    <View
      style={{
        height: 180,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: c.surfaceSoft,
      }}
    >
      <ActivityIndicator color={c.link} />
      <Text style={{ color: c.textMuted, marginTop: 10 }}>
        Carregando foto…
      </Text>
    </View>
  );
}

function CommentsModal({
  visiblePost,
  groupId,
  onClose,
  onChanged,
}: {
  visiblePost: GroupPost | null;
  groupId: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const { colors: c } = useAppTheme();
  const s = styles(c);
  const { api, user } = useAuth();
  const [comments, setComments] = useState<GroupComment[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    if (!visiblePost) return;
    try {
      const items = await api.listGroupComments(groupId, visiblePost.id);
      setComments(items);
      setLoadError("");
    } catch (failure) {
      setLoadError(groupErrorMessage(failure, { not_found: "Esta publicação não está mais disponível." }));
    } finally {
      setLoading(false);
    }
  }, [api, groupId, visiblePost]);
  // The parent remounts this modal per post (key), so state starts clean for each one.
  useEffect(() => {
    if (!visiblePost) return;
    let active = true;
    api
      .listGroupComments(groupId, visiblePost.id)
      .then((items) => { if (active) setComments(items); })
      .catch((failure) => { if (active) setLoadError(groupErrorMessage(failure, { not_found: "Esta publicação não está mais disponível." })); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, groupId, visiblePost]);
  const send = async () => {
    if (!visiblePost || !text.trim() || sending) return;
    setSending(true);
    setSendError("");
    try {
      await api.createGroupComment(groupId, visiblePost.id, text.trim());
      setText("");
      await load();
      void onChanged();
    } catch (failure) {
      setSendError(groupErrorMessage(failure, { conflict: "Os comentários foram desativados nesta publicação.", network: "Comentário não enviado. Confira sua conexão; o texto foi mantido." }));
    } finally {
      setSending(false);
    }
  };
  const remove = async (comment: GroupComment) => {
    const confirmed = await confirmAction({
      title: "Excluir comentário?",
      message: "O comentário deixará de aparecer para os membros do grupo. Essa ação não pode ser desfeita.",
      confirmLabel: "Excluir comentário",
      destructive: true,
    });
    if (!confirmed) return;
    setDeleting(comment.id);
    setSendError("");
    try {
      await api.deleteGroupComment(groupId, comment.id);
      await load();
      void onChanged();
    } catch (failure) {
      setSendError(groupErrorMessage(failure, { not_found: "Este comentário já foi removido." }));
    } finally {
      setDeleting(null);
    }
  };
  return (
    <Modal
      visible={Boolean(visiblePost)}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.modalSafe}><FormKeyboardAvoidingView style={{flex:1}}>
        <View style={s.commentsHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="Fechar comentários" onPress={onClose} style={s.iconButton}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={22}
              color={c.text}
            />
          </Pressable>
          <View style={s.flex}>
            <Text accessibilityRole="header" style={s.commentsTitle}>Comentários</Text>
            <Text numberOfLines={1} style={s.meta}>Publicação de {visiblePost?.author.displayName}</Text>
          </View>
        </View>
        <FlatList keyboardShouldPersistTaps="handled" data={comments} keyExtractor={comment=>comment.id} initialNumToRender={10} maxToRenderPerBatch={10} windowSize={5} contentContainerStyle={s.commentsList} ListHeaderComponent={<>
          {loading ? <ActivityIndicator accessibilityLabel="Carregando comentários" color={c.link} /> : null}
          {loadError ? <View style={s.error}>
            <Text accessibilityRole="alert" style={s.errorText}>{loadError}</Text>
            <Pressable accessibilityRole="button" onPress={() => { setLoading(true); setLoadError(""); void load(); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={s.link}>Tentar novamente</Text></Pressable>
          </View> : null}
          {!loading && !loadError && !comments.length ? (
            <Text style={s.emptyText}>Seja a primeira pessoa a comentar.</Text>
          ) : null}
          </>} renderItem={({item:comment}) => (
            <View key={comment.id} style={s.commentRow}>
              <View style={s.smallAvatar}>
                <Text style={s.smallInitial}>
                  {comment.author.displayName.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={s.commentBubble}>
                <View style={s.commentTop}>
                  <View style={s.flex}>
                    <Text style={s.commentAuthor}>
                      {comment.author.displayName}
                    </Text>
                    <Text style={s.commentDate}>
                      {formatTime(comment.createdAt)}{comment.edited ? " · editado" : ""}
                    </Text>
                  </View>
                  {!comment.removed && comment.author.id === user?.id ? (
                    <Pressable accessibilityRole="button"
                      accessibilityLabel="Excluir comentário"
                      aria-busy={deleting === comment.id} aria-disabled={deleting !== null}
                      disabled={deleting !== null}
                      onPress={() => void remove(comment)}
                      style={s.commentAction}
                    >
                      {deleting === comment.id ? <ActivityIndicator color={c.textMuted} size="small" /> : <MaterialCommunityIcons
                        name="trash-can-outline"
                        size={20}
                        color={c.textMuted}
                      />}
                    </Pressable>
                  ) : null}
                  {!comment.removed && comment.author.id !== user?.id ? (
                    <Pressable accessibilityRole="button"
                      accessibilityLabel={`Denunciar comentário de ${comment.author.displayName}`}
                      onPress={() => setReportTarget({ type: "comment", id: comment.id })}
                      style={s.commentAction}
                    >
                      <MaterialCommunityIcons name="flag-outline" size={20} color={c.textMuted} />
                    </Pressable>
                  ) : null}
                </View>
                <Text style={[s.commentBody, comment.removed && s.removed]}>
                  {comment.text}
                </Text>
              </View>
            </View>
          )}/>
        {notice ? <Text accessibilityLiveRegion="polite" style={s.commentNotice}>{notice}</Text> : null}
        {sendError ? <Text accessibilityRole="alert" style={[s.errorText, s.commentError]}>{sendError}</Text> : null}
        <View style={s.commentComposer}>
          <TextInput
            value={text}
            onChangeText={setText}
            maxLength={1000}
            multiline
            editable={!sending}
            accessibilityLabel="Escrever comentário"
            placeholder="Escreva um comentário..."
            placeholderTextColor={c.textMuted}
            style={s.commentInput}
          />
          <Pressable accessibilityRole="button"
            accessibilityLabel="Enviar comentário"
            aria-disabled={!text.trim() || sending} aria-busy={sending}
            disabled={!text.trim() || sending}
            onPress={() => void send()}
            style={[s.send, (!text.trim() || sending) && s.disabled]}
          >
            {sending ? <ActivityIndicator color={c.white} size="small" /> : <MaterialCommunityIcons name="send" size={19} color={c.white} />}
          </Pressable>
        </View>
      </FormKeyboardAvoidingView></SafeAreaView>
      <ReportContentSheet groupId={groupId} target={reportTarget} onClose={() => setReportTarget(null)} onSent={() => setNotice("Denúncia enviada. Obrigado por avisar.")} />
    </Modal>
  );
}

const styles = (c: AppPalette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    content: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 120,
      gap: 12,
      maxWidth: 720,
      width: "100%",
      alignSelf: "center",
    },
    topBar: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border },
    headerIcon: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceSoft },
    moreButton: { width: 44, height: 44, marginRight: -8, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md },
    commentAction: { width: 44, height: 44, marginTop: -10, marginRight: -10, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md },
    commentError: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: c.dangerSoft },
    commentNotice: { ...Type.label, color: c.notificationText, backgroundColor: c.notificationBackground, paddingHorizontal: 16, paddingVertical: 8 },
    actionCancel: { justifyContent: 'center', borderBottomWidth: 0 },
    topShortcut: { position: 'absolute', top: 10, left: 0, right: 0, alignItems: 'center', zIndex: 2 },
    topShortcutButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.primaryStrong, paddingHorizontal: 16, minHeight: 44, borderRadius: 24 },
    dock: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: c.surface, paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: c.border, zIndex: 3 },
    dockActions: { flexDirection: 'row', gap: 10, maxWidth: 688, width: '100%', alignSelf: 'center' },
    dockWrite: { flex: 1, minHeight: 48, backgroundColor: c.primaryStrong, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
    dockWriteText: { color: c.white, fontWeight: '800', fontSize: 14 },
    dockPhoto: { minHeight: 48, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center', gap: 7 },
    composerOverlay: { flex: 1, backgroundColor: Scrim, justifyContent: 'flex-end' },
    composerSheet: { maxHeight: '90%', width: '100%', maxWidth: 720, alignSelf: 'center', backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
    composerHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 4 },
    composerGroup: { color: c.textMuted, fontSize: 12, paddingHorizontal: 16 },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: c.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: c.border,
    },
    flex: { flex: 1, minWidth: 0 },
    title: { ...Type.bodyLarge, fontWeight: "800", color: c.text },
    headerMeta: { ...Type.caption, color: c.textMuted, marginTop: 2 },
    composer: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      padding: 13,
      gap: 10,
    },
    composerRow: { flexDirection: "row", gap: 10 },
    userAvatar: {
      width: 43,
      height: 43,
      borderRadius: 24,
      backgroundColor: c.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    userInitial: { color: c.link, fontWeight: "800" },
    eventAvatar: { backgroundColor: c.primarySoft },
    composerInput: {
      flex: 1,
      minHeight: 43,
      maxHeight: 130,
      color: c.text,
      fontSize: 14,
      paddingTop: 10,
      textAlignVertical: "top",
    },
    composerInputExpanded: { minHeight: 72 },
    composerFooter: { flexDirection: "row", alignItems: "center", gap: 9 },
    photoButton: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingVertical: 8,
      paddingHorizontal: 9,
      backgroundColor: c.primarySoft,
      borderRadius: 12,
    },
    photoText: { color: c.link, fontWeight: "800", fontSize: 12 },
    characters: { fontSize: 12, color: c.textMuted, marginLeft: "auto" },
    publish: {
      minHeight: 44,
      backgroundColor: c.primary,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    publishText: { color: c.white, fontWeight: "800", fontSize: 12 },
    disabled: { opacity: 0.4 },
    photoPreview: { borderRadius: 16, overflow: "hidden" },
    previewImage: { width: "100%", height: 200 },
    removePhoto: {
      position: "absolute",
      top: 9,
      right: 9,
      width: 44,
      height: 44,
      borderRadius: 24,
      backgroundColor: Scrim,
      alignItems: "center",
      justifyContent: "center",
    },
    temporaryNote: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 2,
    },
    temporaryNoteText: { color: c.warning, fontSize: 12, flex: 1 },
    restrictedText: { color: c.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
    post: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 24,
      overflow: "hidden",
    },
    postHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 15,
      paddingBottom: 11,
    },
    authorRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    author: { color: c.text, fontWeight: "800", fontSize: 14 },
    postKindBadge: {
      backgroundColor: c.primarySoft,
      borderRadius: 8,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    postKindText: { color: c.link, fontSize: 12, fontWeight: "800" },
    time: { color: c.textMuted, fontSize: 12, marginTop: 3 },
    postText: {
      color: c.text,
      fontSize: 15,
      lineHeight: 22,
      paddingHorizontal: 16,
      paddingBottom: 15,
    },
    eventText: { fontSize: 15, fontWeight: "800" },
    postPhotoWrap: {
      position: "relative",
      backgroundColor: c.surfaceSoft,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: c.border,
    },
    expiryBadge: {
      position: "absolute",
      right: 10,
      bottom: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 12,
      paddingHorizontal: 9,
      paddingVertical: 6,
      backgroundColor: Scrim,
    },
    expiryText: { color: c.white, fontSize: 12, fontWeight: "800" },
    engagementSummary: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      minHeight: 34,
      paddingHorizontal: 15,
      paddingTop: 8,
    },
    reactionTotal: { color: c.textMuted, fontSize: 12 },
    commentTotal: { color: c.textMuted, fontSize: 12 },
    postActions: {
      borderTopWidth: 1,
      borderTopColor: c.border,
      marginTop: 5,
      paddingHorizontal: 10,
      paddingVertical: 8,
      flexDirection: "row",
      alignItems: "center",
    },
    reactions: { gap: 2 },
    reaction: {
      width: 44,
      height: 44,
      borderRadius: Radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    reactionSelected: {
      backgroundColor: c.primarySoft,
      borderWidth: 1,
      borderColor: c.primary,
    },
    emoji: { fontSize: 18 },
    commentButton: {
      marginLeft: "auto",
      minHeight: 44,
      paddingHorizontal: 9,
      paddingVertical: 7,
      flexDirection: "row",
      gap: 5,
      alignItems: "center",
    },
    commentText: { color: c.link, fontWeight: "800", fontSize: 12 },
    empty: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      padding: 24,
      alignItems: "center",
      gap: 8,
    },
    emptyTitle: { color: c.text, fontSize: 16, fontWeight: "800" },
    emptyText: {
      color: c.textMuted,
      fontSize: 12,
      lineHeight: 18,
      textAlign: "center",
    },
    error: {
      backgroundColor: c.dangerSoft,
      padding: 13,
      borderRadius: 16,
      gap: 4,
    },
    errorText: { color: c.danger },
    link: { color: c.link, fontWeight: "800" },
    loading: { paddingVertical: 30 },
    actionOverlay: {
      flex: 1,
      backgroundColor: Scrim,
      justifyContent: "flex-end",
    },
    actionSheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 25,
      borderTopRightRadius: 25,
      padding: 20,
      paddingBottom: 35,
      gap: 5,
    },
    actionTitle: {
      fontSize: 19,
      fontWeight: "800",
      color: c.text,
      marginBottom: 8,
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: 52,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    actionText: { flex: 1, fontSize: 15, fontWeight: "700", color: c.text },
    modalSafe: { flex: 1, backgroundColor: c.background },
    commentsHeader: {
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    commentsTitle: { fontSize: 20, fontWeight: "800", color: c.text },
    meta: { fontSize: 12, color: c.textMuted },
    commentsList: { padding: 16, gap: 13 },
    commentRow: { flexDirection: "row", gap: 9, alignItems: "flex-start" },
    smallAvatar: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: c.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    smallInitial: { color: c.onPrimarySoft, fontWeight: "800" },
    commentBubble: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 11,
      gap: 4,
    },
    commentTop: { flexDirection: "row", alignItems: "flex-start", gap: 4 },
    commentAuthor: { color: c.text, fontWeight: "800", fontSize: 12 },
    commentBody: { color: c.text, fontSize: 13, lineHeight: 19 },
    removed: { color: c.textMuted, fontStyle: "italic" },
    commentDate: { color: c.textMuted, fontSize: 12 },
    commentComposer: {
      padding: 12,
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.surface,
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 9,
    },
    commentInput: {
      flex: 1,
      maxHeight: 110,
      minHeight: 45,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      paddingHorizontal: 13,
      paddingVertical: 11,
      color: c.text,
    },
    send: {
      width: 45,
      height: 45,
      borderRadius: 16,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
  });
