import { FormScrollView as ScrollView } from '@/components/form-scroll-view';
import { FormInput as TextInput } from '@/components/form-input';
import { BodyMeasurementGuide } from '@/components/body-measurement-guide';
import { useAppTheme } from "@/theme/theme-provider";
import type { AppPalette } from "@/constants/theme";
import {
  bodyMeasurementInputSchema,
  dailyExpenditureInputSchema,
  foodInputSchema,
  mealInputSchema,
  type BodyMeasurement,
  type DailyExpenditure,
  type FavoriteMeal,
  type Food,
  type FoodInput,
  type Meal,
  type MealInput,
  type DietMealInput,
  type PublicUser,
} from "@fit/contracts";
import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatRelativeDay } from "@/utils/dates";
import {
  dateInputToIso,
  formatDateInput,
  isoDateToInput,
} from "@/utils/date-input";
import {
  formatDecimalInput,
  formatDecimalValue,
  formatIntegerInput,
  formatTimeInput,
  formatWeightInput,
  formatWeightValue,
} from "@/utils/input-format";
import { DietMealForm } from "@/components/diet-meal-form";
import { InformationModal } from "@/components/information-modal";
import { energyBalanceDetails } from "@/utils/nutrition-summary";

const numeric = (value: string) => Number(value.replace(",", "."));
const optionalNumeric = (value: string) =>
  value.trim() ? numeric(value) : null;

function FormModal({
  title,
  busy,
  error,
  onClose,
  onSave,
  saveLabel = "Salvar",
  children,
}: {
  title: string;
  busy: boolean;
  error: string;
  onClose(): void;
  onSave(): void;
  saveLabel?: string;
  children: ReactNode;
}) {
  const { colors: c } = useAppTheme();
  const s = styles(c);
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <Text accessibilityRole="header" style={s.title}>
            {title}
          </Text>
          <Pressable accessibilityRole="button" disabled={busy} onPress={onClose} hitSlop={8} style={s.close}>
            <Text style={s.link}>Fechar</Text>
          </Pressable>
        </View>
        <View
          style={s.flex}
        >
          <ScrollView automaticallyAdjustKeyboardInsets={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.content}
          >
            {children}
            {error ? (
              <Text accessibilityRole="alert" style={s.error}>
                {error}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onSave}
              style={[s.primary, busy && s.disabled]}
            >
              {busy ? (
                <ActivityIndicator color={c.onPrimary} />
              ) : (
                <Text style={s.primaryText}>{saveLabel}</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
function Field({
  label,
  value,
  onChange,
  placeholder = "Ex.: preencha este campo",
  numericField = false,
  numberField = false,
  multiline = false,
  maxLength,
  onFocus,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  placeholder?: string;
  numericField?: boolean;
  numberField?: boolean;
  multiline?: boolean;
  maxLength?: number;
  onFocus?(): void;
}) {
  const { colors: c, scheme } = useAppTheme();
  const s = styles(c);
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardAppearance={scheme}
        placeholderTextColor={c.textMuted}
        value={value}
        onFocus={onFocus}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType={
          numberField ? "number-pad" : numericField ? "decimal-pad" : "default"
        }
        multiline={multiline}
        maxLength={maxLength ?? (multiline ? 500 : 120)}
        style={[s.input, multiline && s.notes]}
      />
    </View>
  );
}
type ChoiceCallback<T extends string> = {
  bivarianceHack(value: T): void;
}["bivarianceHack"];
function Choice<T extends string>({
  value,
  current,
  label,
  onPress,
}: {
  value: T;
  current: T;
  label: string;
  onPress: ChoiceCallback<T>;
}) {
  const { colors: c } = useAppTheme();
  const s = styles(c);
  return (
    <Pressable
      accessibilityRole="radio"
      aria-checked={value === current}
      onPress={() => onPress(value)}
      style={[s.choice, value === current && s.choiceSelected]}
    >
      <Text style={value === current ? s.choiceTextSelected : s.choiceText}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Full-width radio with a short description, for choices that need a word of context. */
function OptionCard<T extends string>({
  value,
  current,
  label,
  description,
  onPress,
}: {
  value: T;
  current: T | null;
  label: string;
  description: string;
  onPress: ChoiceCallback<T>;
}) {
  const { colors: c } = useAppTheme();
  const s = styles(c);
  const selected = value === current;
  return (
    <Pressable
      accessibilityRole="radio"
      aria-checked={selected}
      onPress={() => onPress(value)}
      style={[s.option, selected && s.optionSelected]}
    >
      <View style={[s.radio, selected && s.radioSelected]}>{selected ? <View style={s.radioDot} /> : null}</View>
      <View style={s.optionText}>
        <Text style={s.itemTitle}>{label}</Text>
        <Text style={s.helper}>{description}</Text>
      </View>
    </Pressable>
  );
}

export function FoodForm({
  initial,
  onClose,
  onSave,
}: {
  initial: Food | null;
  onClose(): void;
  onSave(input: FoodInput): Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [serving, setServing] = useState(
    formatDecimalValue(initial?.servingAmount),
  );
  const [unit, setUnitState] = useState<FoodInput["servingUnit"]>(
    initial?.servingUnit ?? "g",
  );
  const setUnit = (value: string) =>
    setUnitState(value as FoodInput["servingUnit"]);
  const [calories, setCalories] = useState(
    formatDecimalValue(initial?.calories),
  );
  const [protein, setProtein] = useState(formatDecimalValue(initial?.protein));
  const [carbs, setCarbs] = useState(formatDecimalValue(initial?.carbs));
  const [fat, setFat] = useState(formatDecimalValue(initial?.fat));
  const [fiber, setFiber] = useState(formatDecimalValue(initial?.fiber));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const s = styles(useAppTheme().colors);
  const save = async () => {
    const parsed = foodInputSchema.safeParse({
      name,
      brand: brand.trim() || null,
      servingAmount: numeric(serving),
      servingUnit: unit,
      calories: numeric(calories),
      protein: numeric(protein),
      carbs: numeric(carbs),
      fat: numeric(fat),
      fiber: optionalNumeric(fiber),
      notes: notes.trim() || null,
    });
    if (!parsed.success) {
      setError(
        "Revise os campos. Porção deve ser positiva e nutrientes não podem ser negativos.",
      );
      return;
    }
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await onSave(parsed.data);
    } catch {
      setError("Não foi possível salvar o alimento. Tente novamente.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <FormModal
      title={initial ? "Editar alimento" : "Novo alimento"}
      busy={busy}
      error={error}
      onClose={onClose}
      onSave={() => void save()}
    >
      <Field
        label="Nome"
        value={name}
        onChange={setName}
        placeholder="Ex.: Arroz integral"
      />
      <Field
        label="Marca · opcional"
        value={brand}
        onChange={setBrand}
        placeholder="Ex.: Tio João"
      />
      <Text style={s.section}>Porção de referência</Text>
      <View style={s.row}>
        <View style={s.grow}>
          <Field
            label="Quantidade"
            value={serving}
            onChange={(value) => setServing(formatDecimalInput(value))}
            placeholder="Ex.: 100"
            numericField
          />
        </View>
        {(["g", "ml", "unit"] as const).map((value) => (
          <Choice
            key={value}
            value={value}
            current={unit}
            label={value === "unit" ? "un" : value}
            onPress={setUnit}
          />
        ))}
      </View>
      <Text style={s.section}>Nutrientes por porção</Text>
      <View style={s.grid}>
        <Field
          label="Calorias (kcal)"
          value={calories}
          onChange={(value) => setCalories(formatDecimalInput(value))}
          placeholder="Ex.: 130"
          numericField
        />
        <Field
          label="Proteínas (g)"
          value={protein}
          onChange={(value) => setProtein(formatDecimalInput(value))}
          placeholder="Ex.: 2,5"
          numericField
        />
        <Field
          label="Carboidratos (g)"
          value={carbs}
          onChange={(value) => setCarbs(formatDecimalInput(value))}
          placeholder="Ex.: 28"
          numericField
        />
        <Field
          label="Gorduras (g)"
          value={fat}
          onChange={(value) => setFat(formatDecimalInput(value))}
          placeholder="Ex.: 1,2"
          numericField
        />
        <Field
          label="Fibras (g) · opcional"
          value={fiber}
          onChange={(value) => setFiber(formatDecimalInput(value))}
          placeholder="Ex.: 1,8"
          numericField
        />
      </View>
      <Field
        label="Observações · opcional"
        value={notes}
        onChange={setNotes}
        placeholder="Ex.: Porção preparada sem óleo"
        multiline
      />
    </FormModal>
  );
}

export function MealForm({
  date,
  foods,
  initial,
  onClose,
  onSave,
  onDietSave,
  dietState,
  foodState,
}: {
  date: string;
  foods: Food[];
  initial: Meal | null;
  onClose(): void;
  onSave(input: MealInput): Promise<void>;
  onDietSave?(input: DietMealInput): Promise<void>;
  dietState?: { loading: boolean; available: boolean; error: string; retry(): void };
  foodState?: { loading: boolean; error: string; retry(): void };
}) {
  const [dietOpen, setDietOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [mealDate, setMealDate] = useState(
    isoDateToInput(initial?.date ?? date),
  );
  const [time, setTime] = useState(initial?.time ?? new Date().toTimeString().slice(0, 5));
  const saveLock = useRef(false);
  const [foodSearch, setFoodSearch] = useState('');
  // One level of choice: quick (calories, macros optional), registered foods, or the diet.
  const [entryMode, setEntryMode] = useState<"quick" | "items">(
    initial?.mode === "items" && !initial.items.some((item) => !item.foodId) ? "items" : "quick",
  );
  const [showMacros, setShowMacros] = useState(
    Boolean(initial && (initial.protein > 0 || initial.carbs > 0 || initial.fat > 0 || initial.fiber != null)),
  );
  const [showWhen, setShowWhen] = useState(Boolean(initial));
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (initial?.items ?? [])
        .filter((item) => item.foodId)
        .map((item) => [item.foodId!, formatDecimalValue(item.quantity)]),
    ),
  );
  const [cals, setCals] = useState(formatDecimalValue(initial?.calories));
  const [protein, setProtein] = useState(formatDecimalValue(initial?.protein));
  const [carbs, setCarbs] = useState(formatDecimalValue(initial?.carbs));
  const [fat, setFat] = useState(formatDecimalValue(initial?.fat));
  const [fiber, setFiber] = useState(formatDecimalValue(initial?.fiber));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { colors: c } = useAppTheme();
  const s = styles(c);
  const preview = useMemo(
    () =>
      foods.reduce(
        (total, food) => {
          const qty = optionalNumeric(quantities[food.id] ?? "");
          const ratio = qty && qty > 0 ? qty / food.servingAmount : 0;
          return {
            calories: total.calories + food.calories * ratio,
            protein: total.protein + food.protein * ratio,
            carbs: total.carbs + food.carbs * ratio,
            fat: total.fat + food.fat * ratio,
          };
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      ),
    [foods, quantities],
  );
  const save = async () => {
    if (saveLock.current) return;
    const isoDate = dateInputToIso(mealDate);
    if (!isoDate) {
      setError("Informe uma data válida no formato DD/MM/AAAA.");
      return;
    }
    if (!name.trim()) {
      setError("Informe o nome da refeição.");
      return;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      setError("Informe um horário válido no formato HH:MM.");
      return;
    }
    if (entryMode === "quick" && !cals.trim()) {
      setError("Informe as calorias da refeição.");
      return;
    }
    const withMacros = entryMode === "quick" && showMacros;
    const payload =
      entryMode === "items"
        ? {
            name,
            date: isoDate,
            time,
            items: foods.flatMap((food) => {
              const quantity = optionalNumeric(quantities[food.id] ?? "");
              return quantity && quantity > 0
                ? [{ foodId: food.id, quantity }]
                : [];
            }),
          }
        : {
            name,
            date: isoDate,
            time,
            directNutrition: {
              calories: numeric(cals),
              protein: withMacros ? numeric(protein || "0") : 0,
              carbs: withMacros ? numeric(carbs || "0") : 0,
              fat: withMacros ? numeric(fat || "0") : 0,
              fiber: withMacros ? optionalNumeric(fiber) : null,
            },
          };
    if (entryMode === "items" && !("items" in payload && payload.items?.length)) {
      setError("Informe a quantidade de ao menos um alimento.");
      return;
    }
    const parsed = mealInputSchema.safeParse(payload);
    if (!parsed.success) {
      setError(
        entryMode === "items"
          ? "Revise as quantidades: use números positivos."
          : "Revise as calorias e os nutrientes: use números positivos dentro dos limites.",
      );
      return;
    }
    saveLock.current = true;
    setBusy(true);
    setError("");
    try {
      await onSave(parsed.data);
    } catch {
      setError("Não foi possível salvar a refeição. Verifique a conexão.");
    } finally {
      saveLock.current = false;
      setBusy(false);
    }
  };
  if (dietOpen && onDietSave)
    return (
      <DietMealForm
        date={dateInputToIso(mealDate) || date}
        onClose={() => setDietOpen(false)}
        onSave={onDietSave}
      />
    );
  return (
    <FormModal
      title={initial ? "Editar refeição" : "Registrar refeição"}
      busy={busy}
      error={error}
      onClose={onClose}
      onSave={() => void save()}
    >
      <View accessibilityRole="radiogroup" accessibilityLabel="Como registrar" style={s.row}>
        <Choice value="quick" current={entryMode} label="Rápida" onPress={() => setEntryMode("quick")} />
        <Choice value="items" current={entryMode} label="Com alimentos" onPress={() => setEntryMode("items")} />
        {!initial && onDietSave ? <Choice value="diet" current={entryMode} label="Refeição da dieta" onPress={() => setDietOpen(true)} /> : null}
      </View>
      <Text style={s.helper}>
        {entryMode === "quick"
          ? "Nome e calorias bastam. Proteínas, carboidratos e gorduras são opcionais."
          : "Informe quanto comeu de alimentos já cadastrados; os nutrientes são calculados."}
      </Text>
      {dietState?.loading ? <Text style={s.helper}>Buscando dieta vinculada…</Text> : dietState?.error ? <Pressable accessibilityRole="button" onPress={dietState.retry} style={{minHeight:44,justifyContent:'center'}}><Text style={s.error}>Não foi possível consultar sua dieta. Tentar novamente</Text></Pressable> : null}
      <Field
        label="Nome"
        value={name}
        onChange={setName}
        placeholder="Ex.: Almoço"
      />
      {!initial ? <View style={[s.row, { flexWrap: 'wrap' }]}>{['Café da manhã', 'Almoço', 'Lanche', 'Jantar'].map(label => <Choice key={label} value={label} current={name} label={label} onPress={setName}/>)}</View> : null}
      {showWhen ? (
        <View style={s.row}>
          <View style={s.grow}>
            <Field
              label="Data (DD/MM/AAAA)"
              value={mealDate}
              onChange={(value) => setMealDate(formatDateInput(value))}
              placeholder="Ex.: 28/10/2026"
              numberField
              maxLength={10}
            />
          </View>
          <View style={s.grow}>
            <Field
              label="Horário (HH:MM)"
              value={time}
              onChange={(value) => setTime(formatTimeInput(value))}
              placeholder="Ex.: 12:30"
              numberField
              maxLength={5}
            />
          </View>
        </View>
      ) : (
        <View style={s.whenRow}>
          <Text style={[s.helper, s.grow]}>
            {dateInputToIso(mealDate) ? formatRelativeDay(dateInputToIso(mealDate)!) : mealDate} às {time}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Alterar data e horário" onPress={() => setShowWhen(true)} style={s.inlineLink}>
            <Text style={s.link}>Alterar</Text>
          </Pressable>
        </View>
      )}
      {entryMode === "items" ? (
        <View style={s.stack}>
          {foodState?.loading ? <ActivityIndicator accessibilityLabel="Carregando alimentos" color={c.link}/> : null}
          {foodState?.error ? <Pressable accessibilityRole="button" onPress={foodState.retry} style={{minHeight:44,justifyContent:'center'}}><Text style={s.error}>Não foi possível carregar seus alimentos. Tentar novamente</Text></Pressable> : null}
          {foods.length ? (
            <>
              <Field label="Buscar alimento" value={foodSearch} onChange={setFoodSearch} placeholder="Nome do alimento"/>
              {foods.filter(food => food.name.toLocaleLowerCase('pt-BR').includes(foodSearch.trim().toLocaleLowerCase('pt-BR'))).map((food) => (
                <View key={food.id} style={s.foodLine}>
                  <View style={s.grow}>
                    <Text style={s.itemTitle}>{food.name}</Text>
                    <Text style={s.helper}>
                      {food.servingAmount}{" "}
                      {food.servingUnit === "unit" ? "un" : food.servingUnit} ·{" "}
                      {food.calories} kcal
                    </Text>
                  </View>
                  <TextInput
                    accessibilityLabel={`Quantidade de ${food.name} em ${food.servingUnit === "unit" ? "unidades" : food.servingUnit}`}
                    placeholder="Ex.: 100"
                    placeholderTextColor={c.textMuted}
                    keyboardType="decimal-pad"
                    value={quantities[food.id] ?? ""}
                    onChangeText={(value) =>
                      setQuantities((current) => ({
                        ...current,
                        [food.id]: formatDecimalInput(value),
                      }))
                    }
                    style={[s.input, s.qty]}
                  />
                </View>
              ))}
              <View style={s.preview}>
                <Text style={s.itemTitle}>Total calculado</Text>
                <Text style={s.helper}>
                  {Math.round(preview.calories)} kcal · Proteínas{" "}
                  {preview.protein.toFixed(1)} g · Carboidratos {preview.carbs.toFixed(1)}{" "}
                  g · Gorduras {preview.fat.toFixed(1)} g
                </Text>
              </View>
            </>
          ) : foodState?.loading || foodState?.error ? null : (
            <View style={s.stack}>
              <Text style={s.helper}>
                Você ainda não cadastrou alimentos. Cadastre-os em Alimentação → Alimentos ou use o registro rápido.
              </Text>
              <Pressable accessibilityRole="button" onPress={() => setEntryMode("quick")} style={s.inlineLink}>
                <Text style={s.link}>Usar registro rápido</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : (
        <View style={s.grid}>
          <Field
            label="Calorias (kcal)"
            value={cals}
            onChange={(value) => setCals(formatDecimalInput(value))}
            placeholder="Ex.: 650"
            numericField
          />
          <Pressable
            accessibilityRole="checkbox"
            aria-checked={showMacros}
            onPress={() => setShowMacros((value) => !value)}
            style={s.checkRow}
          >
            <View style={[s.checkbox, showMacros && s.checkboxChecked]}>
              {showMacros ? <Text style={s.checkMark}>✓</Text> : null}
            </View>
            <Text style={[s.itemTitle, s.grow]}>Informar proteínas, carboidratos e gorduras</Text>
          </Pressable>
          {showMacros ? <>
          <Field
            label="Proteínas (g)"
            value={protein}
            onChange={(value) => setProtein(formatDecimalInput(value))}
            placeholder="Ex.: 35"
            numericField
          />
          <Field
            label="Carboidratos (g)"
            value={carbs}
            onChange={(value) => setCarbs(formatDecimalInput(value))}
            placeholder="Ex.: 75"
            numericField
          />
          <Field
            label="Gorduras (g)"
            value={fat}
            onChange={(value) => setFat(formatDecimalInput(value))}
            placeholder="Ex.: 18"
            numericField
          />
          <Field
            label="Fibras (g) · opcional"
            value={fiber}
            onChange={(value) => setFiber(formatDecimalInput(value))}
            placeholder="Ex.: 8"
            numericField
          />
          </> : null}
        </View>
      )}
    </FormModal>
  );
}

export function ExpenditureForm({
  date,
  current,
  user,
  latestWeight,
  initialMode,
  onClose,
  onSave,
}: {
  date: string;
  current: DailyExpenditure | null;
  user: PublicUser | null;
  latestWeight: number | null;
  initialMode?: "manual" | "estimated";
  onClose(): void;
  onSave(
    input: ReturnType<typeof dailyExpenditureInputSchema.parse>,
  ): Promise<void>;
}) {
  const [mode, setModeState] = useState<"manual" | "estimated">(
    initialMode ?? current?.mode ?? "manual",
  );
  const setMode = (value: string) =>
    setModeState(value as "manual" | "estimated");
  const [total, setTotal] = useState(
    formatDecimalValue(current?.totalCalories),
  );
  const [source, setSource] = useState(current?.source ?? "");
  // Formula base comes from the profile's estimationSex (not gender identity); null forces an explicit choice.
  const [gender, setGenderState] = useState<"female" | "male" | null>(
    current?.gender ?? user?.estimationSex ?? null,
  );
  const [infoOpen, setInfoOpen] = useState(false);
  const setGender = (value: string) =>
    setGenderState(value as "female" | "male");
  const [birth, setBirth] = useState(
    isoDateToInput(current?.birthDate ?? user?.birthDate),
  );
  const [height, setHeight] = useState(
    current?.heightCm
      ? String(current.heightCm)
      : user?.heightCm
        ? String(user.heightCm)
        : "",
  );
  const [weight, setWeight] = useState(
    formatWeightValue(current?.weightKg ?? latestWeight),
  );
  const [level, setLevelState] = useState<
    NonNullable<DailyExpenditure["activityLevel"]>
  >(current?.activityLevel ?? user?.activityLevel ?? "sedentary");
  const setLevel = (value: string) =>
    setLevelState(value as NonNullable<DailyExpenditure["activityLevel"]>);
  const [exercise, setExercise] = useState(
    current?.exerciseCalories ? String(current.exerciseCalories) : "0",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const s = styles(useAppTheme().colors);
  const save = async () => {
    const isoBirthDate = dateInputToIso(birth);
    if (mode === "estimated" && !gender) {
      setError("Escolha a base da fórmula (feminina ou masculina) ou informe o valor manualmente.");
      return;
    }
    if (mode === "estimated" && !isoBirthDate) {
      setError("Informe uma data de nascimento válida no formato DD/MM/AAAA.");
      return;
    }
    const payload =
      mode === "manual"
        ? {
            date,
            mode,
            totalCalories: numeric(total),
            source: source.trim() || null,
          }
        : {
            date,
            mode,
            gender,
            birthDate: isoBirthDate!,
            heightCm: numeric(height),
            weightKg: numeric(weight),
            activityLevel: level,
            exerciseCalories: numeric(exercise),
          };
    const parsed = dailyExpenditureInputSchema.safeParse(payload);
    if (!parsed.success) {
      setError(
        mode === "manual"
          ? "Informe o gasto total em kcal, um número inteiro positivo."
          : "Revise altura (80 a 250 cm), peso e calorias dos exercícios; os valores não podem ser negativos.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave(parsed.data);
    } catch {
      setError("Não foi possível salvar o gasto. Confira a conexão e tente novamente.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <FormModal
      title="Ajustar gasto do dia"
      busy={busy}
      error={error}
      onClose={onClose}
      onSave={() => void save()}
    >
      <Text style={s.helper}>
        O valor salvo vale só para esta data e substitui a estimativa
        automática; os dois nunca são somados.
      </Text>
      <View accessibilityRole="radiogroup" style={s.stack}>
        <OptionCard
          value="estimated"
          current={mode}
          label="Personalizar estimativa"
          description="Calculada com seus dados, sua rotina e os exercícios do dia."
          onPress={setMode}
        />
        <OptionCard
          value="manual"
          current={mode}
          label="Informar valor"
          description="Total do dia vindo de relógio, aplicativo ou outro aparelho."
          onPress={setMode}
        />
      </View>
      {mode === "manual" ? (
        <>
          <Field
            label="Gasto total (kcal)"
            value={total}
            onChange={(value) => setTotal(formatIntegerInput(value, 5))}
            placeholder="Ex.: 2350"
            numberField
          />
          <Field
            label="Origem · opcional"
            value={source}
            onChange={setSource}
            placeholder="Ex.: Apple Watch"
          />
        </>
      ) : (
        <>
          <View style={s.explainer}>
            <Text style={s.helper}>
              Calculamos quanto seu corpo gasta em repouso, ajustamos pela sua
              rotina do dia a dia e somamos as calorias dos exercícios. Assim o
              treino não é contado duas vezes.
            </Text>
            <Pressable accessibilityRole="button" onPress={() => setInfoOpen(true)} style={s.inlineLink}>
              <Text style={s.link}>Saiba mais sobre o cálculo</Text>
            </Pressable>
          </View>
          <Text style={s.label}>Base da fórmula</Text>
          <Text style={s.helper}>
            A fórmula usa valores de referência diferentes para as bases
            feminina e masculina. Isso não altera o gênero do seu perfil.
          </Text>
          <View accessibilityRole="radiogroup" style={s.row}>
            <Choice
              value="female"
              current={gender ?? ""}
              label="Feminina"
              onPress={setGender}
            />
            <Choice
              value="male"
              current={gender ?? ""}
              label="Masculina"
              onPress={setGender}
            />
          </View>
          <Field
            label="Nascimento (DD/MM/AAAA)"
            value={birth}
            onChange={(value) => setBirth(formatDateInput(value))}
            placeholder="Ex.: 07/05/1994"
            numberField
            maxLength={10}
          />
          <View style={s.row}>
            <View style={s.grow}>
              <Field
                label="Altura (cm)"
                value={height}
                onChange={(value) => setHeight(formatIntegerInput(value, 3))}
                placeholder="Ex.: 174"
                numberField
                maxLength={3}
              />
            </View>
            <View style={s.grow}>
              <Field
                label="Peso (kg)"
                value={weight}
                onChange={(value) => setWeight(formatWeightInput(value))}
                placeholder="Ex.: 81,20"
                numberField
                maxLength={7}
              />
            </View>
          </View>
          <Text style={s.label}>
            Rotina do dia a dia (sem contar exercícios)
          </Text>
          <View accessibilityRole="radiogroup" style={s.stack}>
            {(
              [
                ["sedentary", "Pouco movimento", "A maior parte do dia em repouso, com poucos deslocamentos."],
                ["light", "Leve", "Algumas caminhadas curtas e tarefas leves."],
                ["moderate", "Moderada", "Em pé ou caminhando boa parte do dia."],
                ["active", "Ativa", "Trabalho ou rotina com esforço físico frequente."],
                ["very_active", "Muito ativa", "Esforço físico intenso na maior parte do dia."],
              ] as const
            ).map(([value, label, description]) => (
              <OptionCard
                key={value}
                value={value}
                current={level}
                label={label}
                description={description}
                onPress={setLevel}
              />
            ))}
          </View>
          <Field
            label="Exercícios deste dia (kcal)"
            value={exercise}
            onChange={(value) => setExercise(formatIntegerInput(value, 5))}
            placeholder="Ex.: 420"
            numberField
          />
        </>
      )}
      {infoOpen ? (
        <InformationModal
          title="Como estimamos o gasto"
          paragraphs={[
            "Primeiro estimamos quanto seu corpo gasta em repouso, a partir de idade, altura, peso e da base da fórmula. Depois ajustamos pela rotina do dia a dia que você escolheu e somamos as calorias dos exercícios informadas.",
            "É uma média para acompanhar tendências, não uma medição do seu corpo nem uma recomendação alimentar.",
          ]}
          details={energyBalanceDetails}
          onClose={() => setInfoOpen(false)}
        />
      ) : null}
    </FormModal>
  );
}

const measurementFields = [
  ["weightKg", "Peso (kg)", "Ex.: 81,20"],
  ["waistCm", "Cintura (cm)", "Ex.: 82"],
  ["abdomenCm", "Abdômen (cm)", "Ex.: 88"],
  ["hipsCm", "Quadril (cm)", "Ex.: 98"],
  ["chestCm", "Peito (cm)", "Ex.: 94"],
  ["leftArmCm", "Braço esquerdo (cm)", "Ex.: 32"],
  ["rightArmCm", "Braço direito (cm)", "Ex.: 32"],
  ["leftThighCm", "Coxa esquerda (cm)", "Ex.: 56"],
  ["rightThighCm", "Coxa direita (cm)", "Ex.: 56"],
] as const;
const bodyMeasurementFields = measurementFields.slice(1);

export function MeasurementForm({
  date,
  initial,
  onClose,
  onSave,
}: {
  date: string;
  initial: BodyMeasurement | null;
  onClose(): void;
  onSave(
    input: ReturnType<typeof bodyMeasurementInputSchema.parse>,
  ): Promise<void>;
}) {
  const [selectedRegion, setSelectedRegion] = useState('waistCm');
  const hasBodyMeasurements = Boolean(
    initial && bodyMeasurementFields.some(([key]) => initial[key] != null),
  );
  const [mode, setModeState] = useState<"weight" | "full">(
    hasBodyMeasurements ? "full" : "weight",
  );
  const setMode = (value: string) => setModeState(value as "weight" | "full");
  const [recordDate, setRecordDate] = useState(
    isoDateToInput(initial?.date ?? date),
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      measurementFields.map(([key]) => [
        key,
        key === "weightKg"
          ? formatWeightValue(initial?.[key])
          : formatDecimalValue(initial?.[key]),
      ]),
    ),
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const s = styles(useAppTheme().colors);
  const visibleFields =
    mode === "weight" ? measurementFields.slice(0, 1) : measurementFields;
  const save = async () => {
    const measurementValues = Object.fromEntries(
      measurementFields.map(([key]) => [
        key,
        mode === "weight" && key !== "weightKg"
          ? null
          : optionalNumeric(values[key] ?? ""),
      ]),
    );
    const isoDate = dateInputToIso(recordDate);
    const parsed = bodyMeasurementInputSchema.safeParse({
      date: isoDate ?? recordDate,
      ...measurementValues,
      notes: notes.trim() || null,
    });
    if (!parsed.success) {
      setError(
        mode === "weight"
          ? "Informe uma data válida e um peso positivo."
          : "Informe uma data válida e ao menos uma medida positiva.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave(parsed.data);
    } catch {
      setError("Não foi possível salvar as medidas.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <FormModal
      title={initial ? "Editar registro" : "Novo registro corporal"}
      busy={busy}
      error={error}
      onClose={onClose}
      onSave={() => void save()}
    >
      <Text style={s.label}>O que deseja registrar?</Text>
      <View accessibilityRole="radiogroup" style={s.row}>
        <Choice
          value="weight"
          current={mode}
          label="Somente peso"
          onPress={setMode}
        />
        <Choice
          value="full"
          current={mode}
          label="Peso e medidas"
          onPress={setMode}
        />
      </View>
      <Text style={s.helper}>
        {mode === "weight"
          ? "Uma opção rápida para acompanhar apenas a variação do peso."
          : "Preencha somente o que mediu. Peso e medidas são opcionais, mas é necessário informar pelo menos um valor."}
      </Text>
      <Field
        label="Data (DD/MM/AAAA)"
        value={recordDate}
        onChange={(value) => setRecordDate(formatDateInput(value))}
        placeholder="Ex.: 28/10/2026"
        numberField
        maxLength={10}
      />
      {mode === 'full' ? <BodyMeasurementGuide selected={selectedRegion} onSelect={setSelectedRegion}/> : null}
      <View style={s.grid}>
        {visibleFields.map(([key, label, placeholder]) => (
          <Field
            key={key}
            onFocus={() => setSelectedRegion(key)}
            label={label}
            value={values[key] ?? ""}
            onChange={(value) =>
              setValues((current) => ({
                ...current,
                [key]:
                  key === "weightKg"
                    ? formatWeightInput(value)
                    : formatDecimalInput(value, 3, 2),
              }))
            }
            placeholder={placeholder}
            numericField
            maxLength={key === "weightKg" ? 7 : 6}
          />
        ))}
      </View>
      <Field
        label="Observações · opcional"
        value={notes}
        onChange={setNotes}
        placeholder="Ex.: Medição feita pela manhã"
        multiline
      />
    </FormModal>
  );
}

export function FavoriteForm({
  favorite,
  date,
  onClose,
  onRename,
  onReuse,
}: {
  favorite: FavoriteMeal;
  date: string;
  onClose(): void;
  onRename(name: string): Promise<void>;
  onReuse(date: string, time: string, multiplier: number): Promise<void>;
}) {
  const [name, setName] = useState(favorite.name);
  const [useDate, setUseDate] = useState(isoDateToInput(date));
  const [time, setTime] = useState("12:00");
  const [multiplier, setMultiplier] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { colors: c } = useAppTheme();
  const s = styles(c);
  const rename = async () => {
    if (name.trim().length < 2) {
      setError("Informe um nome válido.");
      return;
    }
    setBusy(true);
    try {
      await onRename(name.trim());
    } catch {
      setError("Não foi possível salvar o novo nome. Confira a conexão e tente novamente.");
    } finally {
      setBusy(false);
    }
  };
  const reuse = async () => {
    const isoDate = dateInputToIso(useDate);
    const amount = numeric(multiplier);
    if (!isoDate || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !(amount > 0)) {
      setError(!isoDate ? "Informe uma data válida no formato DD/MM/AAAA." : !(amount > 0) ? "Informe quantas porções, um número maior que zero (ex.: 0,5 ou 2)." : "Informe um horário válido no formato HH:MM.");
      return;
    }
    setBusy(true);
    try {
      await onReuse(isoDate, time, amount);
    } catch {
      setError("Não foi possível registrar a refeição. Confira a conexão e tente novamente.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <Text accessibilityRole="header" style={s.title}>Refeição favorita</Text>
          <Pressable accessibilityRole="button" disabled={busy} onPress={onClose} hitSlop={8} style={s.close}>
            <Text style={s.link}>Fechar</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={s.content}>
          <Field
            label="Nome da favorita"
            value={name}
            onChange={setName}
            placeholder="Ex.: Almoço habitual"
          />
          <Pressable accessibilityRole="button"
            disabled={busy}
            onPress={() => void rename()}
            style={s.secondary}
          >
            <Text style={s.secondaryText}>Salvar novo nome</Text>
          </Pressable>
          <View style={s.divider} />
          <Text style={s.section}>Usar em uma nova refeição</Text>
          <Text style={s.helper}>
            Ajuste a quantidade de porções; calorias e nutrientes acompanham
            na mesma proporção. A favorita e os registros anteriores não mudam.
          </Text>
          <View style={s.row}>
            <View style={s.grow}>
              <Field
                label="Data (DD/MM/AAAA)"
                value={useDate}
                onChange={(value) => setUseDate(formatDateInput(value))}
                placeholder="Ex.: 28/10/2026"
                numberField
                maxLength={10}
              />
            </View>
            <View style={s.grow}>
              <Field
                label="Horário (HH:MM)"
                value={time}
                onChange={(value) => setTime(formatTimeInput(value))}
                placeholder="Ex.: 12:30"
                numberField
                maxLength={5}
              />
            </View>
          </View>
          <Field
            label="Porções"
            value={multiplier}
            onChange={(value) => setMultiplier(formatDecimalInput(value, 2, 2))}
            placeholder="Ex.: 1"
            numericField
          />
          <Text style={s.helper}>1 = a porção salva · 0,5 = meia porção · 2 = porção dobrada</Text>
          {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
          <Pressable accessibilityRole="button"
            disabled={busy}
            onPress={() => void reuse()}
            style={[s.primary, busy && s.disabled]}
          >
            {busy ? (
              <ActivityIndicator color={c.onPrimary} />
            ) : (
              <Text style={s.primaryText}>Registrar nesta data</Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = (c: AppPalette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    header: {
      padding: 20,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    title: { flex: 1, color: c.text, fontSize: 22, fontWeight: "800" },
    link: { color: c.link, fontWeight: "800" },
    close: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" },
    inlineLink: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
    whenRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    checkRow: { minHeight: 44, width: "100%", flexDirection: "row", alignItems: "center", gap: 10 },
    checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: c.fieldBorder, alignItems: "center", justifyContent: "center" },
    checkboxChecked: { backgroundColor: c.primary, borderColor: c.primary },
    checkMark: { color: c.onPrimary, fontSize: 14, fontWeight: "800", lineHeight: 16 },
    explainer: { backgroundColor: c.surfaceSoft, borderRadius: 16, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 2 },
    option: {
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 13,
      paddingVertical: 11,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.fieldBorder,
      backgroundColor: c.surface,
    },
    optionSelected: { borderColor: c.primary, borderWidth: 2, backgroundColor: c.primarySoft },
    optionText: { flex: 1, minWidth: 0, gap: 2 },
    radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c.fieldBorder, alignItems: "center", justifyContent: "center" },
    radioSelected: { borderColor: c.primary },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary },
    content: {
      padding: 20,
      paddingBottom: 48,
      gap: 13,
      maxWidth: 680,
      width: "100%",
      alignSelf: "center",
    },
    field: { gap: 5, flex: 1, minWidth: 130 },
    label: { color: c.textMuted, fontSize: 12, fontWeight: "700" },
    input: {
      backgroundColor: c.surface,
      color: c.text,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 13,
      paddingVertical: 12,
    },
    notes: { minHeight: 82, textAlignVertical: "top" },
    section: { color: c.text, fontSize: 16, fontWeight: "800", marginTop: 5 },
    row: {
      flexDirection: "row",
      gap: 9,
      alignItems: "flex-end",
      flexWrap: "wrap",
    },
    grow: { flex: 1, minWidth: 130 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    wrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    stack: { gap: 8 },
    choice: {
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    choiceSelected: { backgroundColor: c.primary, borderColor: c.primary },
    choiceText: { color: c.textMuted, fontSize: 12, fontWeight: "700" },
    choiceTextSelected: { color: c.onPrimary, fontSize: 12, fontWeight: "800" },
    primary: {
      backgroundColor: c.primary,
      borderRadius: 16,
      padding: 16,
      alignItems: "center",
      marginTop: 4,
    },
    primaryText: { color: c.onPrimary, fontWeight: "800" },
    secondary: {
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: 16,
      padding: 13,
      alignItems: "center",
    },
    secondaryText: { color: c.link, fontWeight: "800" },
    disabled: { opacity: 0.55 },
    error: { color: c.danger, lineHeight: 19 },
    helper: { color: c.textMuted, fontSize: 12, lineHeight: 18 },
    foodLine: {
      flexDirection: "row",
      gap: 10,
      alignItems: "center",
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      padding: 11,
    },
    itemTitle: { color: c.text, fontWeight: "800" },
    qty: { width: 88, textAlign: "center" },
    preview: {
      backgroundColor: c.primarySoft,
      borderRadius: 16,
      padding: 13,
      gap: 3,
    },
    notice: { backgroundColor: c.warningSoft, borderRadius: 16, padding: 12 },
    noticeText: { color: c.warning, fontSize: 12, lineHeight: 18 },
    divider: { height: 1, backgroundColor: c.border, marginVertical: 7 },
  });
