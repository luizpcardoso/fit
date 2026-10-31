import { dailyEnergy } from './daily-energy.js';
import { consumptionGoal, type NutritionGoalInput } from '@fit/contracts';
import { pageWindow, type PageQuery } from '@fit/contracts';
import { randomUUID } from 'node:crypto';
import {DietRepository} from './diet-repository.js';
import type {DietMealInput} from '@fit/contracts';
import { QueryTypes, type Sequelize, type Transaction } from 'sequelize';
import type { BodyMeasurement, BodyMeasurementInput, DailyExpenditure, DailyExpenditureInput, DailyNutritionSummary, FavoriteMeal, Food, FoodInput, Meal, MealInput, MealItem, NutritionValues, UpdateFoodInput } from '@fit/contracts';

const factors = { sedentary: 1.2, light: 1.3, moderate: 1.4, active: 1.5, very_active: 1.6 } as const;
const number = (value: unknown) => Number(value);
const optionalNumber = (value: unknown) => value == null ? null : Number(value);
const iso = (value: Date | string) => new Date(value).toISOString();
const dateOnly = (value: Date | string) => typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
const round3 = (value: number) => Math.round(value * 1000) / 1000;

export function ageOnDate(birthDate: string, onDate: string) {
  const [year, month, day] = onDate.split('-').map(Number); const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number);
  return year - birthYear - (month < birthMonth || (month === birthMonth && day < birthDay) ? 1 : 0);
}
export function estimateDailyExpenditure(input: Extract<DailyExpenditureInput, { mode: 'estimated' }>) {
  const age = ageOnDate(input.birthDate, input.date);
  if (age < 13 || age > 120) throw new RangeError('A idade deve estar entre 13 e 120 anos na data do registro.');
  const basalCalories = Math.round(10 * input.weightKg + 6.25 * input.heightCm - 5 * age + (input.gender === 'male' ? 5 : -161));
  const activityTotal = Math.round(basalCalories * factors[input.activityLevel]);
  const activityCalories = Math.max(0, activityTotal - basalCalories);
  return { basalCalories, activityCalories, totalCalories: activityTotal + Math.round(input.exerciseCalories), formula: 'Mifflin-St Jeor + atividade cotidiana sem exercício + exercício do dia' };
}
export function nutritionForQuantity(food: Food, quantity: number): Omit<MealItem, 'id'> {
  const ratio = quantity / food.servingAmount;
  return { foodId: food.id, foodName: food.name, servingAmount: food.servingAmount, servingUnit: food.servingUnit, quantity, calories: round3(food.calories * ratio), protein: round3(food.protein * ratio), carbs: round3(food.carbs * ratio), fat: round3(food.fat * ratio), fiber: food.fiber == null ? null : round3(food.fiber * ratio) };
}

type FoodRow = { id: string; name: string; brand: string | null; serving_amount: string; serving_unit: Food['servingUnit']; calories: string; protein: string; carbs: string; fat: string; fiber: string | null; notes: string | null; created_at: Date; updated_at: Date };
const foodColumns = 'id,name,brand,serving_amount,serving_unit,calories,protein,carbs,fat,fiber,notes,created_at,updated_at';
const mapFood = (row: FoodRow): Food => ({ id: row.id, name: row.name, brand: row.brand, servingAmount: number(row.serving_amount), servingUnit: row.serving_unit, calories: number(row.calories), protein: number(row.protein), carbs: number(row.carbs), fat: number(row.fat), fiber: optionalNumber(row.fiber), notes: row.notes, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) });

type MealRow = { id: string; name: string; meal_date: string | Date; meal_time: string; mode: Meal['mode']; calories: string; protein: string; carbs: string; fat: string; fiber: string | null; created_at: Date; updated_at: Date };
type ItemRow = { id: string; food_id: string | null; food_name: string; serving_amount: string; serving_unit: Food['servingUnit']; quantity: string; calories: string; protein: string; carbs: string; fat: string; fiber: string | null };
const mealColumns = 'id,name,meal_date,meal_time,mode,calories,protein,carbs,fat,fiber,created_at,updated_at';
const itemColumns = 'id,food_id,food_name,serving_amount,serving_unit,quantity,calories,protein,carbs,fat,fiber';
const mapItem = (row: ItemRow): MealItem => ({ id: row.id, foodId: row.food_id, foodName: row.food_name, servingAmount: number(row.serving_amount), servingUnit: row.serving_unit, quantity: number(row.quantity), calories: number(row.calories), protein: number(row.protein), carbs: number(row.carbs), fat: number(row.fat), fiber: optionalNumber(row.fiber) });

type ExpenditureRow = { id: string; expenditure_date: string | Date; mode: DailyExpenditure['mode']; total_calories: number; source: string | null; basal_calories: number | null; activity_calories: number | null; exercise_calories: number | null; formula: string | null; gender: DailyExpenditure['gender']; birth_date: string | Date | null; height_cm: string | null; weight_kg: string | null; activity_level: DailyExpenditure['activityLevel']; created_at: Date; updated_at: Date };
const expenditureColumns = 'id,expenditure_date,mode,total_calories,source,basal_calories,activity_calories,exercise_calories,formula,gender,birth_date,height_cm,weight_kg,activity_level,created_at,updated_at';
const mapExpenditure = (row: ExpenditureRow): DailyExpenditure => ({ id: row.id, date: dateOnly(row.expenditure_date), mode: row.mode, totalCalories: number(row.total_calories), source: row.source, basalCalories: optionalNumber(row.basal_calories), activityCalories: optionalNumber(row.activity_calories), exerciseCalories: optionalNumber(row.exercise_calories), formula: row.formula, gender: row.gender, birthDate: row.birth_date ? dateOnly(row.birth_date) : null, heightCm: optionalNumber(row.height_cm), weightKg: optionalNumber(row.weight_kg), activityLevel: row.activity_level, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) });

type MeasurementRow = { id: string; measurement_date: string | Date; weight_kg: string | null; waist_cm: string | null; abdomen_cm: string | null; hips_cm: string | null; chest_cm: string | null; left_arm_cm: string | null; right_arm_cm: string | null; left_thigh_cm: string | null; right_thigh_cm: string | null; notes: string | null; created_at: Date; updated_at: Date };
const measurementColumns = 'id,measurement_date,weight_kg,waist_cm,abdomen_cm,hips_cm,chest_cm,left_arm_cm,right_arm_cm,left_thigh_cm,right_thigh_cm,notes,created_at,updated_at';
const mapMeasurement = (row: MeasurementRow): BodyMeasurement => ({ id: row.id, date: dateOnly(row.measurement_date), weightKg: optionalNumber(row.weight_kg), waistCm: optionalNumber(row.waist_cm), abdomenCm: optionalNumber(row.abdomen_cm), hipsCm: optionalNumber(row.hips_cm), chestCm: optionalNumber(row.chest_cm), leftArmCm: optionalNumber(row.left_arm_cm), rightArmCm: optionalNumber(row.right_arm_cm), leftThighCm: optionalNumber(row.left_thigh_cm), rightThighCm: optionalNumber(row.right_thigh_cm), notes: row.notes, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) });

export class NutritionRepository {
  constructor(private db: Sequelize) {}
  listDiets(userId:string){return new DietRepository(this.db).list(userId);}
  recordDietMeal(userId:string,input:DietMealInput){return new DietRepository(this.db).record(userId,input);}

  private async deleteOwned(table: 'foods'|'meals'|'favorite_meals'|'body_measurements', userId: string, id: string) {
    return this.db.transaction(async transaction => {
      const [owned] = await this.db.query<{id:string}>(`SELECT id FROM ${table} WHERE id=? AND user_id=? FOR UPDATE`, { replacements:[id,userId],type:QueryTypes.SELECT,transaction });
      if (!owned) return false;
      await this.db.query(`DELETE FROM ${table} WHERE id=? AND user_id=?`, { replacements:[id,userId],type:QueryTypes.DELETE,transaction });
      return true;
    });
  }

  async listFoods(userId: string) { return (await this.db.query<FoodRow>(`SELECT ${foodColumns} FROM foods WHERE user_id=? ORDER BY name,id`, { replacements: [userId], type: QueryTypes.SELECT })).map(mapFood); }
  async createFood(userId: string, input: FoodInput) { const id = randomUUID(); await this.db.query('INSERT INTO foods (id,user_id,name,brand,serving_amount,serving_unit,calories,protein,carbs,fat,fiber,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())', { replacements: [id,userId,input.name,input.brand??null,input.servingAmount,input.servingUnit,input.calories,input.protein,input.carbs,input.fat,input.fiber??null,input.notes??null], type: QueryTypes.INSERT }); return id; }
  async updateFood(userId: string, id: string, input: UpdateFoodInput) { const fields: Array<[string, unknown]> = []; const map: Record<string,string> = { name:'name',brand:'brand',servingAmount:'serving_amount',servingUnit:'serving_unit',calories:'calories',protein:'protein',carbs:'carbs',fat:'fat',fiber:'fiber',notes:'notes' }; for (const [key,column] of Object.entries(map)) if (key in input) fields.push([column,input[key as keyof UpdateFoodInput]??null]); if (!fields.length) return false; const [,count] = await this.db.query(`UPDATE foods SET ${fields.map(([column])=>`${column}=?`).join(',')},updated_at=UTC_TIMESTAMP() WHERE id=? AND user_id=?`, { replacements:[...fields.map(([,value])=>value),id,userId], type:QueryTypes.UPDATE }); return Number(count)>0; }
  async deleteFood(userId: string, id: string) { return this.deleteOwned('foods',userId,id); }

  private async mealItems(mealId: string, transaction?: Transaction) { return (await this.db.query<ItemRow>(`SELECT ${itemColumns} FROM meal_items WHERE meal_id=? ORDER BY created_at,id`, { replacements:[mealId],type:QueryTypes.SELECT,transaction })).map(mapItem); }
  private async mapMeal(row: MealRow, transaction?: Transaction): Promise<Meal> { return { id:row.id,name:row.name,date:dateOnly(row.meal_date),time:row.meal_time.slice(0,5),mode:row.mode,calories:number(row.calories),protein:number(row.protein),carbs:number(row.carbs),fat:number(row.fat),fiber:optionalNumber(row.fiber),items:await this.mealItems(row.id,transaction),createdAt:iso(row.created_at),updatedAt:iso(row.updated_at) }; }
  async listMeals(userId: string, date: string) { const rows=await this.db.query<MealRow>(`SELECT ${mealColumns} FROM meals WHERE user_id=? AND meal_date=? ORDER BY meal_time,id`,{replacements:[userId,date],type:QueryTypes.SELECT}); return Promise.all(rows.map(row=>this.mapMeal(row))); }
  private async prepareMeal(userId: string, input: MealInput, transaction: Transaction) {
    if (input.directNutrition) return { mode:'direct' as const, totals:{...input.directNutrition,fiber:input.directNutrition.fiber??null}, items:[] as Omit<MealItem,'id'>[] };
    const foods=await this.db.query<FoodRow>(`SELECT ${foodColumns} FROM foods WHERE user_id=? AND id IN (?)`,{replacements:[userId,input.items!.map(item=>item.foodId)],type:QueryTypes.SELECT,transaction});
    const byId=new Map(foods.map(row=>[row.id,mapFood(row)])); if (byId.size!==new Set(input.items!.map(item=>item.foodId)).size) return null;
    const items=input.items!.map(entry=>nutritionForQuantity(byId.get(entry.foodId)!,entry.quantity));
    const sum=(key:keyof NutritionValues)=>round3(items.reduce((total,item)=>total+Number(item[key]??0),0)); return {mode:'items' as const,totals:{calories:sum('calories'),protein:sum('protein'),carbs:sum('carbs'),fat:sum('fat'),fiber:items.some(i=>i.fiber!=null)?sum('fiber'):null},items};
  }
  private async insertItems(table: 'meal_items'|'favorite_meal_items', ownerColumn: 'meal_id'|'favorite_id', ownerId: string, items: Omit<MealItem,'id'>[], transaction: Transaction) { for(const item of items) await this.db.query(`INSERT INTO ${table} (id,${ownerColumn},food_id,food_name,serving_amount,serving_unit,quantity,calories,protein,carbs,fat,fiber,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP())`,{replacements:[randomUUID(),ownerId,item.foodId,item.foodName,item.servingAmount,item.servingUnit,item.quantity,item.calories,item.protein,item.carbs,item.fat,item.fiber??null],type:QueryTypes.INSERT,transaction}); }
  async createMeal(userId:string,input:MealInput){return this.db.transaction(async transaction=>{const prepared=await this.prepareMeal(userId,input,transaction);if(!prepared)return null;const id=randomUUID(),v=prepared.totals;await this.db.query('INSERT INTO meals (id,user_id,name,meal_date,meal_time,mode,calories,protein,carbs,fat,fiber,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())',{replacements:[id,userId,input.name,input.date,input.time,prepared.mode,v.calories,v.protein,v.carbs,v.fat,v.fiber??null],type:QueryTypes.INSERT,transaction});await this.insertItems('meal_items','meal_id',id,prepared.items,transaction);return id;});}
  async updateMeal(userId:string,id:string,input:MealInput){return this.db.transaction(async transaction=>{const owned=await this.db.query<{id:string}>('SELECT id FROM meals WHERE id=? AND user_id=? FOR UPDATE',{replacements:[id,userId],type:QueryTypes.SELECT,transaction});if(!owned[0])return false;const prepared=await this.prepareMeal(userId,input,transaction);if(!prepared)return false;const v=prepared.totals;await this.db.query('UPDATE meals SET name=?,meal_date=?,meal_time=?,mode=?,calories=?,protein=?,carbs=?,fat=?,fiber=?,updated_at=UTC_TIMESTAMP() WHERE id=? AND user_id=?',{replacements:[input.name,input.date,input.time,prepared.mode,v.calories,v.protein,v.carbs,v.fat,v.fiber??null,id,userId],type:QueryTypes.UPDATE,transaction});await this.db.query('DELETE FROM meal_items WHERE meal_id=?',{replacements:[id],type:QueryTypes.DELETE,transaction});await this.insertItems('meal_items','meal_id',id,prepared.items,transaction);return true;});}
  async deleteMeal(userId:string,id:string){return this.deleteOwned('meals',userId,id);}

  private async favoriteItems(id:string){return (await this.db.query<ItemRow>(`SELECT ${itemColumns} FROM favorite_meal_items WHERE favorite_id=? ORDER BY created_at,id`,{replacements:[id],type:QueryTypes.SELECT})).map(mapItem);}
  async listFavorites(userId:string):Promise<FavoriteMeal[]>{const rows=await this.db.query<Omit<MealRow,'meal_date'|'meal_time'>>('SELECT id,name,mode,calories,protein,carbs,fat,fiber,created_at,updated_at FROM favorite_meals WHERE user_id=? ORDER BY name,id',{replacements:[userId],type:QueryTypes.SELECT});return Promise.all(rows.map(async row=>({...row,id:row.id,name:row.name,mode:row.mode,calories:number(row.calories),protein:number(row.protein),carbs:number(row.carbs),fat:number(row.fat),fiber:optionalNumber(row.fiber),items:await this.favoriteItems(row.id),createdAt:iso(row.created_at),updatedAt:iso(row.updated_at)})));}
  async createFavoriteFromMeal(userId:string,mealId:string){return this.db.transaction(async transaction=>{const [meal]=await this.db.query<MealRow>(`SELECT ${mealColumns} FROM meals WHERE id=? AND user_id=? FOR UPDATE`,{replacements:[mealId,userId],type:QueryTypes.SELECT,transaction});if(!meal)return null;const id=randomUUID();await this.db.query('INSERT INTO favorite_meals (id,user_id,name,mode,calories,protein,carbs,fat,fiber,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())',{replacements:[id,userId,meal.name,meal.mode,meal.calories,meal.protein,meal.carbs,meal.fat,meal.fiber],type:QueryTypes.INSERT,transaction});await this.insertItems('favorite_meal_items','favorite_id',id,(await this.mealItems(mealId,transaction)).map(({id:_,...item})=>item),transaction);return id;});}
  async renameFavorite(userId:string,id:string,name:string){const [,count]=await this.db.query('UPDATE favorite_meals SET name=?,updated_at=UTC_TIMESTAMP() WHERE id=? AND user_id=?',{replacements:[name,id,userId],type:QueryTypes.UPDATE});return Number(count)>0;}
  async deleteFavorite(userId:string,id:string){return this.deleteOwned('favorite_meals',userId,id);}
  async reuseFavorite(userId:string,id:string,date:string,time:string,multiplier:number){return this.db.transaction(async transaction=>{const [favorite]=await this.db.query<Omit<MealRow,'meal_date'|'meal_time'>>('SELECT id,name,mode,calories,protein,carbs,fat,fiber,created_at,updated_at FROM favorite_meals WHERE id=? AND user_id=? FOR UPDATE',{replacements:[id,userId],type:QueryTypes.SELECT,transaction});if(!favorite)return null;const mealId=randomUUID(),scale=(value:unknown)=>round3(number(value)*multiplier);await this.db.query('INSERT INTO meals (id,user_id,name,meal_date,meal_time,mode,calories,protein,carbs,fat,fiber,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())',{replacements:[mealId,userId,favorite.name,date,time,favorite.mode,scale(favorite.calories),scale(favorite.protein),scale(favorite.carbs),scale(favorite.fat),favorite.fiber==null?null:scale(favorite.fiber)],type:QueryTypes.INSERT,transaction});const items=(await this.favoriteItems(id)).map(({id:_,...item})=>({...item,quantity:scale(item.quantity),calories:scale(item.calories),protein:scale(item.protein),carbs:scale(item.carbs),fat:scale(item.fat),fiber:item.fiber==null?null:scale(item.fiber)}));await this.insertItems('meal_items','meal_id',mealId,items,transaction);return mealId;});}

  async getExpenditure(userId:string,date:string){const [row]=await this.db.query<ExpenditureRow>(`SELECT ${expenditureColumns} FROM daily_expenditures WHERE user_id=? AND expenditure_date=?`,{replacements:[userId,date],type:QueryTypes.SELECT});return row?mapExpenditure(row):null;}
  async saveExpenditure(userId:string,input:DailyExpenditureInput){const estimate=input.mode==='estimated'?estimateDailyExpenditure(input):null;const id=randomUUID();const values=input.mode==='manual'?{total:Math.round(input.totalCalories),source:input.source??null,basal:null,activity:null,exercise:null,formula:null,gender:null,birth:null,height:null,weight:null,level:null}:{total:estimate!.totalCalories,source:null,basal:estimate!.basalCalories,activity:estimate!.activityCalories,exercise:Math.round(input.exerciseCalories),formula:estimate!.formula,gender:input.gender,birth:input.birthDate,height:input.heightCm,weight:input.weightKg,level:input.activityLevel};await this.db.query('INSERT INTO daily_expenditures (id,user_id,expenditure_date,mode,total_calories,source,basal_calories,activity_calories,exercise_calories,formula,gender,birth_date,height_cm,weight_kg,activity_level,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE mode=VALUES(mode),total_calories=VALUES(total_calories),source=VALUES(source),basal_calories=VALUES(basal_calories),activity_calories=VALUES(activity_calories),exercise_calories=VALUES(exercise_calories),formula=VALUES(formula),gender=VALUES(gender),birth_date=VALUES(birth_date),height_cm=VALUES(height_cm),weight_kg=VALUES(weight_kg),activity_level=VALUES(activity_level),updated_at=UTC_TIMESTAMP()',{replacements:[id,userId,input.date,input.mode,values.total,values.source,values.basal,values.activity,values.exercise,values.formula,values.gender,values.birth,values.height,values.weight,values.level],type:QueryTypes.INSERT});return this.getExpenditure(userId,input.date);}
  async deleteExpenditure(userId:string,date:string){return this.db.transaction(async transaction=>{const[owned]=await this.db.query<{id:string}>('SELECT id FROM daily_expenditures WHERE user_id=? AND expenditure_date=? FOR UPDATE',{replacements:[userId,date],type:QueryTypes.SELECT,transaction});if(!owned)return false;await this.db.query('DELETE FROM daily_expenditures WHERE user_id=? AND expenditure_date=?',{replacements:[userId,date],type:QueryTypes.DELETE,transaction});return true;});}
  async saveGoal(userId: string, input: NutritionGoalInput) {
    await this.db.query('INSERT INTO nutrition_goals (user_id,target_calories,updated_at) VALUES (?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE target_calories=VALUES(target_calories),updated_at=UTC_TIMESTAMP()', { replacements: [userId, input.targetCalories], type: QueryTypes.INSERT });
  }
  async getGoal(userId: string) {
    const [row] = await this.db.query<{ target_calories: number | null }>('SELECT target_calories FROM nutrition_goals WHERE user_id=?', { replacements: [userId], type: QueryTypes.SELECT });
    return row?.target_calories == null ? null : Number(row.target_calories);
  }
  async energyEstimate(userId: string, date: string, expenditure: DailyExpenditure | null) {
    if (expenditure) return dailyEnergy(date, { birthDate: null, estimationSex: null, heightCm: null, weightKg: null }, 0, [], expenditure);
    const [profiles, weights, workouts, cardios] = await Promise.all([
      this.db.query<{ birth_date: string | Date | null; estimation_sex: string | null; height_cm: number | null }>('SELECT birth_date,estimation_sex,height_cm FROM users WHERE id=?', { replacements: [userId], type: QueryTypes.SELECT }),
      this.db.query<{ weight_kg: string }>('SELECT weight_kg FROM body_measurements WHERE user_id=? AND measurement_date<=? AND weight_kg IS NOT NULL ORDER BY measurement_date DESC,created_at DESC,id DESC LIMIT 1', { replacements: [userId, date], type: QueryTypes.SELECT }),
      this.db.query<{ total: number }>("SELECT COUNT(*) total FROM workout_sessions WHERE user_id=? AND performed_on=? AND status='completed'", { replacements: [userId, date], type: QueryTypes.SELECT }),
      this.db.query<{ calories: number; mode: string; met: string | null; weight_kg: string | null; duration_minutes: number | null }>('SELECT calories,mode,met,weight_kg,duration_minutes FROM cardio_sessions WHERE user_id=? AND session_date=?', { replacements: [userId, date], type: QueryTypes.SELECT }),
    ]);
    const profile = profiles[0];
    return dailyEnergy(date, { birthDate: profile?.birth_date ? dateOnly(profile.birth_date) : null, estimationSex: profile?.estimation_sex ?? null, heightCm: optionalNumber(profile?.height_cm), weightKg: optionalNumber(weights[0]?.weight_kg) }, Number(workouts[0]?.total ?? 0), cardios.map(row => ({ calories: Number(row.calories), mode: row.mode, met: optionalNumber(row.met), weightKg: optionalNumber(row.weight_kg), durationMinutes: optionalNumber(row.duration_minutes) })), null);
  }
  async summary(userId:string,date:string):Promise<DailyNutritionSummary>{const meals=await this.listMeals(userId,date);const expenditure=await this.getExpenditure(userId,date);const consumed=meals.length?{calories:round3(meals.reduce((t,m)=>t+m.calories,0)),protein:round3(meals.reduce((t,m)=>t+m.protein,0)),carbs:round3(meals.reduce((t,m)=>t+m.carbs,0)),fat:round3(meals.reduce((t,m)=>t+m.fat,0)),fiber:meals.some(m=>m.fiber!=null)?round3(meals.reduce((t,m)=>t+(m.fiber??0),0)):null}:null;const energyEstimate=await this.energyEstimate(userId,date,expenditure);const balance=consumed&&energyEstimate.totalCalories!=null?round3(consumed.calories-energyEstimate.totalCalories):null;return{date,consumed,expenditure,balance,energyEstimate,consumptionGoal:consumptionGoal(await this.getGoal(userId),consumed?.calories??0),status:balance==null?'incomplete':Math.abs(balance)<1?'balanced':balance<0?'deficit':'surplus',meals};}

  async listMeasurements(userId:string){return(await this.db.query<MeasurementRow>(`SELECT ${measurementColumns} FROM body_measurements WHERE user_id=? ORDER BY measurement_date DESC,created_at DESC,id DESC`,{replacements:[userId],type:QueryTypes.SELECT})).map(mapMeasurement);}
  async measurementsPage(userId: string, query: PageQuery) {
    return this.db.transaction(async transaction => {
      const [count] = await this.db.query<{ total: number }>('SELECT COUNT(*) total FROM body_measurements WHERE user_id=?', { replacements: [userId], type: QueryTypes.SELECT, transaction });
      const { offset, ...page } = pageWindow(Number(count.total), query);
      const select = `SELECT ${measurementColumns} FROM body_measurements WHERE user_id=? ORDER BY measurement_date DESC,created_at DESC,id DESC`;
      const items = await this.db.query<MeasurementRow>(`${select} LIMIT ? OFFSET ?`, { replacements: [userId, page.pageSize, offset], type: QueryTypes.SELECT, transaction });
      const latest = offset === 0 ? items.slice(0, 2) : await this.db.query<MeasurementRow>(`${select} LIMIT 2`, { replacements: [userId], type: QueryTypes.SELECT, transaction });
      return { ...page, items: items.map(mapMeasurement), latest: latest.map(mapMeasurement) };
    });
  }
  async createMeasurement(userId:string,input:BodyMeasurementInput){const id=randomUUID();await this.db.query('INSERT INTO body_measurements (id,user_id,measurement_date,weight_kg,waist_cm,abdomen_cm,hips_cm,chest_cm,left_arm_cm,right_arm_cm,left_thigh_cm,right_thigh_cm,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())',{replacements:[id,userId,input.date,input.weightKg??null,input.waistCm??null,input.abdomenCm??null,input.hipsCm??null,input.chestCm??null,input.leftArmCm??null,input.rightArmCm??null,input.leftThighCm??null,input.rightThighCm??null,input.notes??null],type:QueryTypes.INSERT});return id;}
  async updateMeasurement(userId:string,id:string,input:BodyMeasurementInput){const [,count]=await this.db.query('UPDATE body_measurements SET measurement_date=?,weight_kg=?,waist_cm=?,abdomen_cm=?,hips_cm=?,chest_cm=?,left_arm_cm=?,right_arm_cm=?,left_thigh_cm=?,right_thigh_cm=?,notes=?,updated_at=UTC_TIMESTAMP() WHERE id=? AND user_id=?',{replacements:[input.date,input.weightKg??null,input.waistCm??null,input.abdomenCm??null,input.hipsCm??null,input.chestCm??null,input.leftArmCm??null,input.rightArmCm??null,input.leftThighCm??null,input.rightThighCm??null,input.notes??null,id,userId],type:QueryTypes.UPDATE});return Number(count)>0;}
  async deleteMeasurement(userId:string,id:string){return this.deleteOwned('body_measurements',userId,id);}
}
