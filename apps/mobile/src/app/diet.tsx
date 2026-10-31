import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import MaterialCommunityIcons from '@/components/icon';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { DietView } from '@fit/contracts';
import { useAuth } from '@/auth/auth-context';
import { useAppTheme } from '@/theme/theme-provider';
import { DietMealForm, type DietSelection } from '@/components/diet-meal-form';
import { DietExpiry, DietMealRows, DietOptionTabs, DietPlanTabs } from '@/components/diet-plan-view';
import { InformationModal } from '@/components/information-modal';
import { showToast } from '@/components/app-dialog';
import { ScreenHeader } from '@/components/screen-header';
import { localDate } from '@/utils/dates';
export default function DietScreen() {
  const { api } = useAuth(); const { colors: c } = useAppTheme();
  const [rows,setRows] = useState<DietView[]>([]);
  const [loading,setLoading] = useState(true), [refreshing,setRefreshing] = useState(false), [error,setError] = useState('');
  const [dietId,setDietId] = useState<string | null>(null), [mealIndex,setMealIndex] = useState<number | null>(null);
  const [selection,setSelection] = useState<DietSelection | null>(null);
  const [selectedOptions,setSelectedOptions] = useState<Record<string,Record<number,number>>>({});
  const [history,setHistory] = useState(false), [information,setInformation] = useState(false);
  const load = useCallback(async () => { setError(''); try { setRows(await api.listDiets()); } catch { setError('Não foi possível carregar suas dietas. Confira sua conexão.'); } finally { setLoading(false);setRefreshing(false); } },[api]);
  useFocusEffect(useCallback(() => {void load();},[load]));
  const diets = rows.filter(row => history || row.status === 'active');
  const diet = diets.find(row => row.id === dietId) ?? diets[0];
  const options = diet ? selectedOptions[diet.id] ?? {} : {};
  const totals = diet?.meals.reduce((sum,meal,index) => {
    const macros = (meal.options[options[index] ?? 0] ?? meal.options[0]).macros;
    return {calories:sum.calories+macros.calories,protein:sum.protein+macros.protein,carbs:sum.carbs+macros.carbs,fat:sum.fat+macros.fat};
  },{calories:0,protein:0,carbs:0,fat:0}) ?? {calories:0,protein:0,carbs:0,fat:0};
  const total = totals.calories;
  const meal = mealIndex == null ? undefined : diet?.meals[mealIndex];
  const optionIndex = mealIndex == null ? 0 : options[mealIndex] ?? 0;
  const option = meal?.options[optionIndex] ?? meal?.options[0];
  const iconButton = { minWidth:44,minHeight:44,alignItems:'center' as const,justifyContent:'center' as const };
  return <SafeAreaView style={{flex:1,backgroundColor:c.background}}>
    <View style={{paddingHorizontal:16,paddingTop:4,paddingBottom:8,borderBottomWidth:1,borderColor:c.border,gap:2,backgroundColor:c.surface}}>
      <ScreenHeader backLabel="Nutrição" onBack={() => router.canGoBack() ? router.back() : router.replace('/nutrition')}/>
      <Text accessibilityRole="header" style={{fontSize:24,fontWeight: '800',color:c.text}}>Minha dieta</Text>
    </View>
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true);void load();}}/>} contentContainerStyle={{padding:16,gap:14,maxWidth:760,width:'100%',alignSelf:'center',paddingBottom:32}}>
      {loading ? <ActivityIndicator accessibilityLabel="Carregando dietas" color={c.link}/> : null}
      {error ? <View><Text accessibilityRole="alert" style={{color:c.danger}}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load()} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:c.link}}>Tentar novamente</Text></Pressable></View> : null}
      <DietPlanTabs diets={diets} selected={diet?.id} onSelect={id => {setDietId(id);setMealIndex(null);}}/>
      {diet ? <>
        <View style={{gap:6}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:8}}><Text style={{flex:1,color:c.text,fontSize:18,fontWeight:'800'}}>{diet.name}</Text><Pressable accessibilityRole="button" accessibilityLabel="Orientações da dieta" onPress={() => setInformation(true)} style={iconButton}><MaterialCommunityIcons name="information-outline" size={23} color={c.link}/></Pressable></View>
          <Text style={{color:c.textMuted,fontSize:12}}>Por {diet.authorName}{diet.status !== 'active' ? ' · Dieta anterior' : ''}</Text>
          <Text style={{color:c.text,fontWeight:'700'}}>{diet.meals.length} refeições · {Math.round(total)} kcal planejadas</Text>
          <DietExpiry diet={diet}/>
          <Text style={{color:c.textMuted,fontSize:12,lineHeight:18}}>Toque em uma refeição para ver alimentos e alternativas. O planejamento não conta como consumo.</Text>
        </View>
        <DietMealRows diet={diet} options={options} onSelect={setMealIndex}/>
      </> : !loading && !error ? <View style={{paddingVertical:24,gap:12}}><Text style={{color:c.text,fontWeight:'800',fontSize:18}}>Nenhuma dieta disponível</Text><Text style={{color:c.textMuted,lineHeight:20}}>Seu profissional pode enviar uma dieta. Aceite as sugestões para consultar o planejamento aqui.</Text><Pressable accessibilityRole="button" onPress={() => router.push('/my-professionals')} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:c.link}}>Abrir meus profissionais</Text></Pressable></View> : null}
      <Pressable accessibilityRole="button" onPress={() => {setHistory(value => !value);setMealIndex(null);}} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:c.link}}>{history ? 'Mostrar apenas dietas atuais' : 'Ver também dietas anteriores'}</Text></Pressable>
    </ScrollView>
    {diet && meal && option && mealIndex != null ? <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setMealIndex(null)}>
      <SafeAreaView style={{flex:1,backgroundColor:c.background}}>
        <View style={{flexDirection:'row',alignItems:'center',padding:16,borderBottomWidth:1,borderColor:c.border,gap:12}}><View style={{flex:1,gap:4}}><Text accessibilityRole="header" style={{color:c.text,fontSize:22,fontWeight: '800'}}>{meal.name}</Text><Text style={{color:c.textMuted}}>{meal.time || 'Sem horário definido'} · {diet.name}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Fechar detalhes da refeição" onPress={() => setMealIndex(null)} style={iconButton}><MaterialCommunityIcons name="close" size={23} color={c.text}/></Pressable></View>
        <ScrollView contentContainerStyle={{padding:20,gap:16,maxWidth:720,width:'100%',alignSelf:'center'}}>
          <Text style={{color:c.textMuted,fontSize:13}}>Escolha uma alternativa para esta refeição.</Text>
          <DietOptionTabs meal={meal} selected={optionIndex} onSelect={index => setSelectedOptions(current => ({...current,[diet.id]:{...current[diet.id],[mealIndex]:index}}))}/>
          {option.items.map((item,index) => <View key={index} style={{paddingVertical:12,gap:6,borderBottomWidth:1,borderColor:c.border}}><View style={{flexDirection:'row',gap:12,justifyContent:'space-between'}}><Text style={{flex:1,color:c.text,fontSize:16,fontWeight:'700'}}>{item.food.name}</Text><Text style={{color:c.link,fontWeight:'700'}}>{item.quantity} {item.food.servingUnit === 'unit' ? 'un' : item.food.servingUnit}</Text></View>{item.food.notes ? <Text style={{color:c.textMuted,lineHeight:20}}>{item.food.notes}</Text> : null}{item.substitutions ? <Text style={{color:c.textMuted,lineHeight:20}}>Substituições: {item.substitutions}</Text> : null}</View>)}
          <Text style={{color:c.text,fontWeight:'800',lineHeight:20}}>{Math.round(option.macros.calories)} kcal · Proteínas {option.macros.protein.toFixed(1)} g · Carboidratos {option.macros.carbs.toFixed(1)} g · Gorduras {option.macros.fat.toFixed(1)} g</Text>
          <DietExpiry diet={diet}/>
        </ScrollView>
        {diet.status === 'active' ? <View style={{padding:16,borderTopWidth:1,borderColor:c.border}}><Pressable accessibilityRole="button" onPress={() => {setSelection({assignmentId:diet.id,mealIndex,optionIndex});setMealIndex(null);}} style={{backgroundColor:c.primaryStrong,padding:16,borderRadius: 16,minHeight:48,alignItems:'center'}}><Text style={{color:c.onPrimary,fontWeight:'800'}}>Registrar esta opção no diário</Text></Pressable></View> : <Text style={{color:c.textMuted,padding:16}}>Dieta anterior disponível apenas para consulta.</Text>}
      </SafeAreaView>
    </Modal> : null}
    {information && diet ? <InformationModal title="Orientações da dieta" paragraphs={[`Estimativa diária das opções selecionadas: ${Math.round(totals.calories)} kcal · Proteínas ${totals.protein.toFixed(1)} g · Carboidratos ${totals.carbs.toFixed(1)} g · Gorduras ${totals.fat.toFixed(1)} g.`,diet.objective || 'Sem objetivo adicional informado.',diet.notes || 'Sem orientações adicionais.',diet.expiresAt ? `Validade ${diet.expired ? 'encerrada em' : 'até'} ${new Date(diet.expiresAt).toLocaleDateString('pt-BR')}.` : 'Sem prazo definido.', 'As opções de uma refeição são alternativas. A estimativa diária soma uma opção por refeição; registrar consumo não altera a prescrição.']} onClose={() => setInformation(false)}/> : null}
    {selection ? <DietMealForm date={localDate()} selection={selection} onClose={() => setSelection(null)} onSave={async input => {await api.recordDietMeal(input);setSelection(null);showToast('Refeição registrada na Alimentação.');}}/> : null}
  </SafeAreaView>;
}
