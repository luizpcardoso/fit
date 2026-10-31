import { DailyNutritionCard } from '@/components/daily-nutrition-card';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { showToast } from '@/components/app-dialog';
import { ScreenHeader } from '@/components/screen-header';
import { formatRelativeDay, formatShortDate, formatSpokenDate, localDate, shiftDate } from '@/utils/dates';
import { useAuth } from "@/auth/auth-context";
import { FavoriteForm, FoodForm, MealForm } from "@/components/nutrition-forms";
import { CardShadow, type AppPalette } from "@/constants/theme";
import { useAppTheme } from "@/theme/theme-provider";
import type { DailyNutritionSummary, FavoriteMeal, Food, Meal } from "@fit/contracts";
import MaterialCommunityIcons from '@/components/icon';
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const kcal = (value: number) =>
  `${Math.round(value).toLocaleString("pt-BR")} kcal`;
type Section = "meals" | "foods" | "favorites";

export default function FoodTracking() {
  const { colors: c } = useAppTheme();
  const s = styles(c);
  const { api } = useAuth();
  const requestVersion = useRef(0);
  const [summary, setSummary] = useState<DailyNutritionSummary | null>(null);
  const [deleting, setDeleting] = useState<{ title: string; message: string; confirmLabel: string; done: string; action(): Promise<void> } | null>(null);
  const [section, setSection] = useState<Section>("meals");
  const [date, setDate] = useState(localDate());
  const [meals, setMeals] = useState<Meal[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [favorites, setFavorites] = useState<FavoriteMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [foodForm, setFoodForm] = useState<Food | null | undefined>(undefined);
  const [mealForm, setMealForm] = useState<Meal | null | undefined>(undefined);
  const [favoriteForm, setFavoriteForm] = useState<FavoriteMeal | null>(null);
  const load = useCallback(
    async (silent = false) => {
      const version = ++requestVersion.current;
      if (!silent) setLoading(true);
      setError("");
      try {
        const [nextMeals, nextFoods, nextFavorites] = await Promise.all([
          api.getNutritionSummary(date),
          api.listFoods(),
          api.listFavoriteMeals(),
        ]);
        if (version !== requestVersion.current) return;
        setSummary(nextMeals);
        setMeals(nextMeals.meals);
        setFoods(nextFoods);
        setFavorites(nextFavorites);
      } catch {
        if (version === requestVersion.current) setError("Não foi possível carregar sua alimentação.");
      } finally {
        if (version === requestVersion.current) { setLoading(false); setRefreshing(false); }
      }
    },
    [api, date],
  );
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => { ++requestVersion.current; };
    }, [load]),
  );
  const confirmDelete = (title: string, message: string, confirmLabel: string, done: string, action: () => Promise<void>) => setDeleting({ title, message, confirmLabel, done, action });
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load(true);
            }}
          />
        }
        contentContainerStyle={s.content}
      >
        <ScreenHeader backLabel="Nutrição" />
        <View>
          <Text accessibilityRole="header" style={s.heading}>
            Alimentação
          </Text>
          <Text style={s.subheading}>Registre o que comeu e acompanhe o consumo diário</Text>
        </View>
        <View accessibilityRole="tablist" style={s.tabs}>
          {(
            [
              ["meals", "Refeições"],
              ["foods", "Alimentos"],
              ["favorites", "Favoritas"],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="tab"
              aria-selected={section === value}
              onPress={() => setSection(value)}
              style={[s.tab, section === value && s.tabSelected]}
            >
              <Text style={[s.tabText, section === value && s.tabTextSelected]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        {section === "meals" ? (
          <View style={s.dateNav}>
            <Pressable accessibilityRole="button"
              accessibilityLabel="Dia anterior"
              onPress={() => setDate((current) => shiftDate(current, -1))}
              style={s.dateButton}
            >
              <MaterialCommunityIcons
                name="chevron-left"
                size={22}
                color={c.link}
              />
            </Pressable>
            <Pressable accessibilityRole="button"
              accessibilityLabel={date === localDate() ? `Hoje, ${formatSpokenDate(date)}` : `${formatSpokenDate(date)}. Voltar para hoje`}
              onPress={() => setDate(localDate())}
              style={s.dateCenter}
            >
              <Text style={s.date}>{formatRelativeDay(date)}</Text>
              <Text style={s.muted}>
                {date === localDate() ? formatShortDate(date) : "Voltar para hoje"}
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button"
              accessibilityLabel="Próximo dia"
              onPress={() => setDate((current) => shiftDate(current, 1))}
              style={s.dateButton}
            >
              <MaterialCommunityIcons
                name="chevron-right"
                size={22}
                color={c.link}
              />
            </Pressable>
          </View>
        ) : null}
        {section === 'meals' ? <DailyNutritionCard summary={summary?.date === date ? summary : null} loading={loading} error={error} onRefresh={() => void load(true)} onRegister={() => setMealForm(null)}/> : <Text style={s.muted}>{section === 'foods' ? 'Cadastre porções de alimentos para reutilizá-las nas refeições.' : 'Use uma refeição salva novamente, ajustando data, horário e quantidade.'}</Text>}
        {error && section !== 'meals' ? (
          <View accessibilityRole="alert" style={s.errorBox}>
            <Text style={s.error}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => void load()} style={s.retry}>
              <Text style={s.link}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : null}
        {loading ? (
          <ActivityIndicator color={c.link} style={s.loading} />
        ) : error ? null : section === "meals" ? (
          <Meals
            meals={meals}
            onNew={() => setMealForm(null)}
            onEdit={setMealForm}
            onFavorite={async (meal) => {
              try {
                await api.favoriteMeal(meal.id);
                await load(true);
                showToast("Refeição adicionada às favoritas.");
              } catch {
                showToast("Não foi possível adicionar às favoritas. Confira a conexão e tente novamente.", "error");
              }
            }}
            onDelete={(meal) =>
              confirmDelete("Excluir refeição?", `${meal.name} será removida deste dia.`, "Excluir refeição", "Refeição excluída.", () =>
                api.deleteMeal(meal.id),
              )
            }
          />
        ) : section === "foods" ? (
          <Foods
            foods={foods}
            onNew={() => setFoodForm(null)}
            onEdit={setFoodForm}
            onDelete={(food) =>
              confirmDelete(
                "Excluir alimento?",
                "Refeições anteriores serão preservadas.",
                "Excluir alimento",
                "Alimento excluído.",
                () => api.deleteFood(food.id),
              )
            }
          />
        ) : (
          <Favorites
            favorites={favorites}
            onOpen={setFavoriteForm}
            onDelete={(favorite) =>
              confirmDelete(
                "Excluir favorita?",
                "Refeições anteriores não serão alteradas.",
                "Excluir favorita",
                "Favorita excluída.",
                () => api.deleteFavoriteMeal(favorite.id),
              )
            }
          />
        )}
      </ScrollView>
      {foodForm !== undefined ? (
        <FoodForm
          initial={foodForm}
          onClose={() => setFoodForm(undefined)}
          onSave={async (input) => {
            if (foodForm) await api.updateFood(foodForm.id, input);
            else await api.createFood(input);
            setFoodForm(undefined);
            await load(true);
          }}
        />
      ) : null}
      {mealForm !== undefined ? (
        <MealForm
          onDietSave={async (input) => {
            await api.recordDietMeal(input);
            setMealForm(undefined);
            if (input.date === date) await load(true);
            else setDate(input.date);
            showToast("Refeição da dieta registrada.");
          }}
          date={date}
          foods={foods}
          initial={mealForm}
          onClose={() => setMealForm(undefined)}
          onSave={async (input) => {
            if (mealForm) await api.updateMeal(mealForm.id, input);
            else await api.createMeal(input);
            setMealForm(undefined);
            showToast(mealForm ? 'Refeição atualizada.' : 'Refeição registrada.');
            if (input.date === date) await load(true);
            else setDate(input.date);
          }}
        />
      ) : null}
      {favoriteForm ? (
        <FavoriteForm
          favorite={favoriteForm}
          date={date}
          onClose={() => setFavoriteForm(null)}
          onRename={async (name) => {
            await api.renameFavoriteMeal(favoriteForm.id, name);
            setFavoriteForm(null);
            showToast("Nome da favorita salvo.");
            await load(true);
          }}
          onReuse={async (nextDate, time, multiplier) => {
            await api.reuseFavoriteMeal(
              favoriteForm.id,
              nextDate,
              time,
              multiplier,
            );
            setFavoriteForm(null);
            setSection("meals");
            showToast('Refeição registrada.');
            if (nextDate === date) await load(true); else setDate(nextDate);
          }}
        />
      ) : null}
      {deleting ? <ConfirmDialog title={deleting.title} message={deleting.message} onCancel={() => setDeleting(null)} confirmLabel={deleting.confirmLabel} onConfirm={async () => { await deleting.action(); setDeleting(null); showToast(deleting.done); await load(true); }}/> : null}
    </SafeAreaView>
  );
}

function Meals({
  meals,
  onNew,
  onEdit,
  onFavorite,
  onDelete,
}: {
  meals: Meal[];
  onNew(): void;
  onEdit(item: Meal): void;
  onFavorite(item: Meal): Promise<void>;
  onDelete(item: Meal): void;
}) {
  const s = styles(useAppTheme().colors);
  return (
    <View style={s.stack}>
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Refeições do dia</Text>

      </View>
      {meals.length ? (
        [...meals].sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id)).map((meal) => (
          <View key={meal.id} style={s.card}>
            <Text style={s.cardTitle}>
              {meal.time} · {meal.name}
            </Text>
            <Text style={s.muted}>
              {kcal(meal.calories)} · Proteínas {meal.protein.toFixed(1)} g · Carboidratos{" "}
              {meal.carbs.toFixed(1)} g · Gorduras {meal.fat.toFixed(1)} g
            </Text>
            {meal.items.map(item=><Text key={item.id} style={s.muted}>{item.foodName} · {item.quantity.toLocaleString('pt-BR')} {item.servingUnit==='unit'?'un':item.servingUnit}</Text>)}
            <View style={s.actions}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Favoritar ${meal.name}`} onPress={() => void onFavorite(meal)} style={s.action}>
                <Text style={s.link}>Favoritar</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Editar ${meal.name}`} onPress={() => onEdit(meal)} style={s.action}>
                <Text style={s.link}>Editar</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Excluir ${meal.name}`} onPress={() => onDelete(meal)} style={s.action}>
                <Text style={s.danger}>Excluir</Text>
              </Pressable>
            </View>
          </View>
        ))
      ) : (
        <Empty
          title="Nenhuma refeição"
          text="Registre por alimentos ou informe os totais nutricionais."
          action="Registrar refeição"
          onPress={onNew}
        />
      )}
    </View>
  );
}
function Foods({
  foods,
  onNew,
  onEdit,
  onDelete,
}: {
  foods: Food[];
  onNew(): void;
  onEdit(item: Food): void;
  onDelete(item: Food): void;
}) {
  const s = styles(useAppTheme().colors);
  return (
    <View style={s.stack}>
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Meus alimentos</Text>
        <Pressable accessibilityRole="button" onPress={onNew} style={s.primarySmall}>
          <Text style={s.primaryText}>+ Cadastrar</Text>
        </Pressable>
      </View>
      {foods.length ? (
        foods.map((food) => (
          <View key={food.id} style={s.card}>
            <Text style={s.cardTitle}>
              {food.name}
              {food.brand ? ` · ${food.brand}` : ""}
            </Text>
            <Text style={s.muted}>
              {food.servingAmount}{" "}
              {food.servingUnit === "unit" ? "un" : food.servingUnit} ·{" "}
              {kcal(food.calories)}
            </Text>
            <Text style={s.muted}>
              Proteínas {food.protein} g · Carboidratos {food.carbs} g · Gorduras {food.fat} g
            </Text>
            <View style={s.actions}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Editar ${food.name}`} onPress={() => onEdit(food)} style={s.action}>
                <Text style={s.link}>Editar</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Excluir ${food.name}`} onPress={() => onDelete(food)} style={s.action}>
                <Text style={s.danger}>Excluir</Text>
              </Pressable>
            </View>
          </View>
        ))
      ) : (
        <Empty
          title="Nenhum alimento"
          text="Crie sua lista para registrar refeições rapidamente."
          action="Cadastrar alimento"
          onPress={onNew}
        />
      )}
    </View>
  );
}
function Favorites({
  favorites,
  onOpen,
  onDelete,
}: {
  favorites: FavoriteMeal[];
  onOpen(item: FavoriteMeal): void;
  onDelete(item: FavoriteMeal): void;
}) {
  const s = styles(useAppTheme().colors);
  return (
    <View style={s.stack}>
      <Text style={s.sectionTitle}>Refeições favoritas</Text>
      {favorites.length ? (
        favorites.map((item) => (
          <View key={item.id} style={s.card}>
            <Text style={s.cardTitle}>{item.name}</Text>
            <Text style={s.muted}>
              {kcal(item.calories)} · Proteínas {item.protein.toFixed(1)} g · Carboidratos{" "}
              {item.carbs.toFixed(1)} g · Gorduras {item.fat.toFixed(1)} g
            </Text>
            <View style={s.actions}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Usar ou renomear ${item.name}`} onPress={() => onOpen(item)} style={s.action}>
                <Text style={s.link}>Usar ou renomear</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Excluir ${item.name}`} onPress={() => onDelete(item)} style={s.action}>
                <Text style={s.danger}>Excluir</Text>
              </Pressable>
            </View>
          </View>
        ))
      ) : (
        <Empty
          title="Nenhuma favorita"
          text="Favorite uma refeição para reutilizá-la."
        />
      )}
    </View>
  );
}
function Empty({
  title,
  text,
  action,
  onPress,
}: {
  title: string;
  text: string;
  action?: string;
  onPress?(): void;
}) {
  const s = styles(useAppTheme().colors);
  return (
    <View style={s.empty}>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.muted}>{text}</Text>
      {action && onPress ? (
        <Pressable accessibilityRole="button" onPress={onPress} style={s.outline}>
          <Text style={s.link}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = (c: AppPalette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    content: {
      padding: 20,
      paddingBottom: 50,
      gap: 16,
      maxWidth: 720,
      width: "100%",
      alignSelf: "center",
    },
    heading: { fontSize: 29, fontWeight: "800", color: c.text },
    subheading: { color: c.textMuted, fontSize: 13, marginTop: 2 },
    tabs: {
      flexDirection: "row",
      padding: 4,
      gap: 4,
      backgroundColor: c.surfaceSoft,
      borderRadius: 16,
    },
    tab: {
      flex: 1,
      minHeight: 44,
      justifyContent: "center",
      paddingVertical: 11,
      alignItems: "center",
      borderRadius: 12,
    },
    tabSelected: { backgroundColor: c.surface, ...CardShadow },
    tabText: { fontSize: 12, color: c.textMuted, fontWeight: "700" },
    tabTextSelected: { color: c.link, fontWeight: "800" },
    dateNav: { flexDirection: "row", alignItems: "center", gap: 9 },
    dateButton: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    dateCenter: { flex: 1, alignItems: "center" },
    date: { color: c.text, fontSize: 16, fontWeight: "800" },
    muted: { color: c.textMuted, fontSize: 12, lineHeight: 18 },
    loading: { padding: 35 },
    errorBox: {
      backgroundColor: c.dangerSoft,
      padding: 13,
      borderRadius: 16,
      gap: 8,
    },
    error: { color: c.danger, fontSize: 12 },
    retry: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
    stack: { gap: 11 },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    sectionTitle: { color: c.text, fontSize: 19, fontWeight: "800" },
    primarySmall: {
      minHeight: 44,
      justifyContent: "center",
      backgroundColor: c.primary,
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderRadius: 12,
    },
    primaryText: { color: c.onPrimary, fontSize: 12, fontWeight: "800" },
    card: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      padding: 14,
      gap: 7,
    },
    cardTitle: { color: c.text, fontSize: 15, fontWeight: "800" },
    actions: {
      flexDirection: "row",
      flexWrap: "wrap",
      columnGap: 8,
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: 2,
      marginTop: 3,
    },
    action: { minHeight: 44, justifyContent: "center", paddingHorizontal: 6 },
    link: { color: c.link, fontSize: 12, fontWeight: "800" },
    danger: { color: c.danger, fontSize: 12, fontWeight: "800" },
    empty: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      padding: 20,
      gap: 9,
    },
    emptyTitle: { color: c.text, fontSize: 17, fontWeight: "800" },
    outline: {
      minHeight: 44,
      justifyContent: "center",
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: 12,
      padding: 12,
      alignSelf: "flex-start",
    },
  });
