import { FormStickyFooter } from '@/components/form-sticky-footer';
import { FormScrollView as ScrollView } from '@/components/form-scroll-view';
import { FormInput as TextInput } from '@/components/form-input';
import { DietExpiry, DietMealRows, DietOptionTabs, DietPlanTabs } from '@/components/diet-plan-view';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import {
  dietMacros,
  dietMealInputSchema,
  type DietMealInput,
  type DietView,
} from "@fit/contracts";
import { useAuth } from "@/auth/auth-context";
import { useAppTheme } from "@/theme/theme-provider";
import {
  dateInputToIso,
  formatDateInput,
  isoDateToInput,
} from "@/utils/date-input";
import {
  formatDecimalInput,
  formatDecimalValue,
  formatTimeInput,
} from "@/utils/input-format";
export type DietSelection = {
  assignmentId: string;
  mealIndex: number;
  optionIndex: number;
};
export function DietMealForm({
  date,
  selection,
  onClose,
  onSave,
}: {
  date: string;
  selection?: DietSelection;
  onClose(): void;
  onSave(input: DietMealInput): Promise<void>;
}) {
  const { api } = useAuth(),
    { colors: c } = useAppTheme();
  const [diets, setDiets] = useState<DietView[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);
  const [planId, setPlanId] = useState<string | null>(selection?.assignmentId ?? null);
  const [chosen, setChosen] = useState<DietSelection | null>(selection || null),
    [quantities, setQuantities] = useState<string[]>([]),
    [recordDate, setRecordDate] = useState(isoDateToInput(date)),
    [time, setTime] = useState("12:00");
  const lock = useRef(false),
    requestId = useRef(Crypto.randomUUID());
  const requestSignature=useRef('');
  const choose=useCallback((rows:DietView[],choice:DietSelection|null)=>{
    setChosen(choice);
    const meal=choice?rows.find(row=>row.id===choice.assignmentId)?.meals[choice.mealIndex]:undefined;
    const option=choice?meal?.options[choice.optionIndex]:undefined;
    setQuantities(option?.items.map(item=>formatDecimalValue(item.quantity))||[]);
    setTime(meal?.time||'12:00');
  },[]);
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const rows=(await api.listDiets()).filter(diet=>diet.status==='active');setDiets(rows);choose(rows,chosen);
    } catch {
      setError(
        "Não foi possível carregar suas dietas. Confira sua conexão e tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let active = true;
    void api
      .listDiets()
      .then((rows) => {
        if (active) {const available=rows.filter(row=>row.status==='active');setDiets(available);choose(available,selection||null);}
      })
      .catch(() => {
        if (active) setError("Não foi possível carregar suas dietas. Confira sua conexão e tente novamente.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api,choose,selection]);
  const diet = diets.find((row) => row.id === chosen?.assignmentId),
    meal = chosen ? diet?.meals[chosen.mealIndex] : undefined,
    option = chosen ? meal?.options[chosen.optionIndex] : undefined;
  const totals = useMemo(
    () =>
      option && quantities.length === option.items.length
        ? dietMacros(
            option.items,
            quantities.map((value) => Number(value.replace(",", "."))),
          )
        : null,
    [option, quantities],
  );
  const save = async () => {
    if (lock.current) return;
    const parsed = dietMealInputSchema.safeParse({
      ...chosen,
      date: dateInputToIso(recordDate),
      time,
      quantities: quantities.map((value) => Number(value.replace(",", "."))),
      requestId: requestId.current,
    });
    if (!parsed.success || !option) {
      setError(
        !option ? "Escolha a refeição que você consumiu."
          : !dateInputToIso(recordDate) ? "Informe uma data válida no formato DD/MM/AAAA."
          : !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? "Informe um horário válido no formato HH:MM."
          : "Revise as quantidades: use números maiores que zero.",
      );
      return;
    }
    const signature=JSON.stringify({...parsed.data,requestId:undefined});
    if(requestSignature.current&&requestSignature.current!==signature)requestId.current=Crypto.randomUUID();
    requestSignature.current=signature;parsed.data.requestId=requestId.current;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await onSave(parsed.data);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Não foi possível registrar a refeição. Confira a conexão e tente novamente.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const field = {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    color: c.text,
  };
  const plan = diets.find(row => row.id === planId) ?? diets[0];
  return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => {if (!busy) onClose();}}>
    <SafeAreaView style={{flex:1,backgroundColor:c.background}}>
      <View style={{flexDirection:'row',alignItems:'center',padding:16,gap:12,borderBottomWidth:1,borderColor:c.border}}>
        <Text accessibilityRole="header" style={{flex:1,color:c.text,fontSize:22,fontWeight: '800'}}>Refeição da dieta</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar refeição da dieta" disabled={busy} onPress={onClose} style={{minHeight:44,minWidth:60,justifyContent:'center',alignItems:'center'}}><Text style={{color:c.link}}>Voltar</Text></Pressable>
      </View>
      <View style={{flex:1}}>
        <ScrollView bottomOffset={option ? footerHeight + 16 : 16} keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:20,gap:16,maxWidth:720,width:'100%',alignSelf:'center',paddingBottom:32}}>
          {loading ? <ActivityIndicator accessibilityLabel="Carregando dietas vinculadas" color={c.link}/> : null}
          {error ? <View><Text accessibilityRole="alert" style={{color:c.danger}}>{error}</Text><Pressable accessibilityRole="button" disabled={busy} onPress={() => void load()} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:c.link}}>Atualizar dietas</Text></Pressable></View> : null}
          {!loading && !error && !diets.length ? <Text style={{color:c.textMuted,lineHeight:20}}>Nenhuma dieta vinculada disponível. Aceite as sugestões em Meus profissionais ou solicite um plano ao seu profissional.</Text> : null}
          {!option ? <>
            <Text style={{color:c.textMuted,lineHeight:20}}>Escolha a refeição que consumiu. Depois, confira a opção e ajuste as quantidades.</Text>
            <DietPlanTabs diets={diets} selected={plan?.id} onSelect={setPlanId}/>
            {plan ? <><View style={{gap:5}}><Text style={{color:c.text,fontSize:18,fontWeight:'800'}}>{plan.name}</Text><Text style={{color:c.textMuted,fontSize:12}}>Por {plan.authorName}</Text><DietExpiry diet={plan}/></View><DietMealRows diet={plan} onSelect={mealIndex => choose(diets,{assignmentId:plan.id,mealIndex,optionIndex:0})}/></> : null}
          </> : diet && meal && chosen ? <>
            <View style={{gap:6}}><Text style={{color:c.text,fontSize:21,fontWeight: '800'}}>{meal.name}</Text><Text style={{color:c.textMuted,fontSize:12}}>{diet.name} · {meal.time || 'Sem horário definido'}</Text><Pressable accessibilityRole="button" disabled={busy} onPress={() => {setPlanId(diet.id);choose(diets,null);}} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:c.link}}>Alterar refeição</Text></Pressable><DietExpiry diet={diet}/></View>
            <DietOptionTabs meal={meal} selected={chosen.optionIndex} disabled={busy} onSelect={optionIndex => choose(diets,{...chosen,optionIndex})}/>
            <Text style={{color:c.textMuted,lineHeight:20}}>Ajuste ao que você consumiu. O planejamento original será preservado.</Text>
              {option.items.map((item, index) => (
                <View key={index} style={{ gap: 6 }}>
                  <Text style={{ color: c.text }}>
                    {item.food.name} (
                    {item.food.servingUnit === "unit"
                      ? "un"
                      : item.food.servingUnit}
                    )
                  </Text>
                  <TextInput
                    accessibilityLabel={`Quantidade consumida de ${item.food.name}`}
                    editable={!busy}
                    value={quantities[index] || ""}
                    onChangeText={(value) =>
                      setQuantities((current) =>
                        current.map((qty, i) =>
                          i === index ? formatDecimalInput(value) : qty,
                        ),
                      )
                    }
                    keyboardType="decimal-pad"
                    style={field}
                  />
                </View>
              ))}
              <Text style={{ color: c.textMuted }}>
                Estimativa:{" "}
                {totals && Object.values(totals).every(Number.isFinite)
                  ? `${Math.round(totals.calories)} kcal · Proteínas ${totals.protein.toFixed(1)} g · Carboidratos ${totals.carbs.toFixed(1)} g · Gorduras ${totals.fat.toFixed(1)} g`
                  : "revise as quantidades"}
              </Text>
              <Text style={{ color: c.text }}>Data (DD/MM/AAAA)</Text>
              <TextInput
                accessibilityLabel="Data da refeição da dieta"
                editable={!busy}
                value={recordDate}
                onChangeText={(v) => setRecordDate(formatDateInput(v))}
                keyboardType="number-pad"
                maxLength={10}
                style={field}
              />
              <Text style={{ color: c.text }}>Horário (HH:MM)</Text>
              <TextInput
                accessibilityLabel="Horário da refeição da dieta"
                editable={!busy}
                value={time}
                onChangeText={(v) => setTime(formatTimeInput(v))}
                keyboardType="number-pad"
                maxLength={5}
                style={field}
              />

          </> : null}
        </ScrollView>
        {option ? <FormStickyFooter onLayout={event => setFooterHeight(event.nativeEvent.layout.height)}><View style={{padding:16,borderTopWidth:1,borderColor:c.border,backgroundColor:c.background}}><Pressable accessibilityRole="button" accessibilityLabel="Registrar consumo da dieta" disabled={busy || loading} onPress={() => void save()} style={{minHeight:48,padding:16,borderRadius: 16,backgroundColor:c.primaryStrong,alignItems:'center'}}>{busy ? <ActivityIndicator color={c.onPrimary}/> : <Text style={{color:c.onPrimary,fontWeight: '800'}}>Registrar consumo</Text>}</Pressable></View></FormStickyFooter> : null}
      </View>
    </SafeAreaView>
  </Modal>;
}
