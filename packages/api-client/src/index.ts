import type { NutritionGoalInput, Page, HealthPageQuery, PageQuery } from '@fit/contracts';
import type { ApiError, AuthResponse, CatalogExercise, CompleteWorkoutInput, CreateWorkoutPlanInput, LoginInput, PublicUser, RegisterInput, SuggestedWorkoutPlan, Supplement, SupplementInput, SupplementToday, UpdateProfileInput, UpdateSupplementInput, UpdateWorkoutPlanInput, UpdateWorkoutSessionInput, WorkoutGoalInput, WorkoutGoalSummary, WorkoutPlan, WorkoutSession } from '@fit/contracts';
import type { HealthKind, HealthItem, HealthItemInput, HealthToday, UpdateHealthItemInput, MedicationToday } from '@fit/contracts';
import type { BodyMeasurement, BodyMeasurementInput, DailyExpenditure, DailyExpenditureInput, DailyNutritionSummary, FavoriteMeal, Food, FoodInput, Meal, MealInput, UpdateFoodInput } from '@fit/contracts';
import type { CardioSession, CardioSessionInput } from '@fit/contracts';
import type { HomeShortcuts } from '@fit/contracts';
import type { MentalCheckIn, MentalCheckInInput } from '@fit/contracts';
import type { Injectable, InjectableEstimate, InjectableInput, InjectableToday, UpdateInjectableInput } from '@fit/contracts';
import type { CreateGroupInput,CreateGroupPostInput,GroupComment,GroupDashboard,GroupDetails,GroupEventSettings,GroupInvite,GroupMember,GroupNotification,GroupPost,GroupReaction,GroupReport,GroupReportReason,GroupSharePreferences,GroupSummary,GroupUser,UpdateGroupInput,UpdateGroupPostInput,UpdateSocialProfileInput } from '@fit/contracts';
import type { ProfessionalRelationship, PortalAssignment } from '@fit/contracts';
import type {DietView,DietMealInput} from '@fit/contracts';

export class ApiClientError extends Error {
  constructor(public readonly status: number, public readonly details: ApiError) { super(details.message); }
}

type TokenPair = Pick<AuthResponse, 'accessToken' | 'refreshToken'>;
type ClientOptions = {
  baseUrl: string;
  getTokens?: () => Promise<TokenPair | null>;
  saveTokens?: (tokens: TokenPair | null) => Promise<void>;
};

export function createApiClient(options: ClientOptions) {
  const transportHeaders: Record<string,string> = /\.(?:ngrok-free\.(?:app|dev)|ngrok\.app)$/.test(new URL(options.baseUrl).hostname) ? {'ngrok-skip-browser-warning':'1'} : {};
  const normalizeMedia=(value:any):any=>{if(Array.isArray(value))return value.map(normalizeMedia);if(value&&typeof value==='object'){for(const key of Object.keys(value)){if((key==='avatarUrl'||key==='imageUrl')&&typeof value[key]==='string'&&value[key].startsWith('/media/'))value[key]=`${options.baseUrl}${value[key]}`;else if(typeof value[key]==='object')normalizeMedia(value[key]);}}return value;};
  let refreshInFlight: Promise<void> | null = null;
  const networkRequest = async <T>(path: string, init: RequestInit = {}, retry = true, binary = false): Promise<T> => {
    const tokens = await options.getTokens?.();
    const response = await fetch(`${options.baseUrl}${path}`, {
      ...init,
      headers: { ...transportHeaders, ...(init.body ? {'content-type': 'application/json'} : {}), ...(tokens?.accessToken ? { authorization: `Bearer ${tokens.accessToken}` } : {}), ...init.headers },
    });
    if (response.status === 401 && retry && tokens?.refreshToken && path !== '/auth/refresh') {
      try {
        const latest = await options.getTokens?.();
        if (latest?.accessToken === tokens.accessToken) {
          if (!refreshInFlight) refreshInFlight = request<AuthResponse>('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: tokens.refreshToken }) }, false)
            .then(async refreshed => { await options.saveTokens?.(refreshed); })
            .finally(() => { refreshInFlight = null; });
          await refreshInFlight;
        }
        return networkRequest<T>(path, init, false, binary);
      } catch (error) { if (error instanceof ApiClientError && error.status === 401) await options.saveTokens?.(null); throw error; }
    }
    if (!response.ok) {
      const fallback: ApiError = { code: 'INTERNAL_ERROR', message: 'Não foi possível concluir a solicitação.' };
      let details = fallback;
      try { details = await response.json() as ApiError; } catch { /* resposta sem JSON */ }
      throw new ApiClientError(response.status, details);
    }
    if (response.status === 204) return undefined as T;
    if (binary) return await response.blob() as T;
    return normalizeMedia(await response.json()) as T;
  };
  const recent=new Map<string,{until:number;value:unknown}>();
  const pending=new Map<string,Promise<unknown>>();
  const request=async<T>(path:string,init:RequestInit={},retry=true,binary=false):Promise<T>=>{
    const read=!init.method||init.method==='GET';
    if(!read){recent.clear();pending.clear();}
    const reusable=read&&!binary&&(!path.includes('/photo')||path.endsWith('/photo-access'))&&!path.startsWith('/auth/')&&!path.startsWith('/media/');
    const cached=recent.get(path);if(reusable&&cached&&cached.until>Date.now())return cached.value as T;
    if(reusable&&pending.has(path))return pending.get(path) as Promise<T>;
    const work=networkRequest<T>(path,init,retry,binary);
    if(reusable){pending.set(path,work);void work.then(value=>{if(pending.get(path)===work){recent.set(path,{until:Date.now()+15_000,value});if(recent.size>50)recent.delete(recent.keys().next().value!);}}).catch(()=>{}).finally(()=>{if(pending.get(path)===work)pending.delete(path)});}
    const value=await work;if(!read)recent.clear();return value;
  };
  return {
    listDiets:()=>request<DietView[]>('/nutrition/diets'),
    recordDietMeal:(input:DietMealInput)=>request<{id:string}>('/nutrition/diet-meals',{method:'POST',body:JSON.stringify(input)}),
    listProfessionals:()=>request<ProfessionalRelationship[]>('/me/professionals'),
    listProfessionalAssignments:()=>request<PortalAssignment[]>('/me/professional-assignments'),
    respondProfessionalAssignment:(id:string,accept:boolean)=>request<{ok:boolean}>(`/me/professional-assignments/${encodeURIComponent(id)}/respond`,{method:'POST',body:JSON.stringify({accept})}),
    professionalConsent:(id:string,action:'accept'|'decline'|'revoke'|'reduce',capabilities:string[])=>request<{ok:boolean}>(`/me/professionals/${encodeURIComponent(id)}/consent`,{method:'POST',body:JSON.stringify({action,capabilities})}),
    setAvatar:(photoDataUrl:string|null)=>request<PublicUser>('/me/avatar',{method:'PUT',body:JSON.stringify({photoDataUrl})}),
    publishToGroups:(groupIds:string[],input:CreateGroupPostInput)=>request<{ids:string[]}>('/groups/posts',{method:'POST',body:JSON.stringify({groupIds,...input})}),
    sendFeedback:(input:import('@fit/contracts').FeedbackInput)=>request<{id:string}>('/me/feedback',{method:'POST',body:JSON.stringify(input)}),
    updateSocialProfile:(input:UpdateSocialProfileInput)=>request<PublicUser>('/me/social-profile',{method:'PATCH',body:JSON.stringify(input)}),
    searchUsers:(username:string)=>request<GroupUser[]>(`/users/search?username=${encodeURIComponent(username)}`),
    listGroups:()=>request<GroupSummary[]>('/groups'),
    getGroupsDashboard:()=>request<GroupDashboard>('/groups/dashboard'),
    createGroup:(input:CreateGroupInput)=>request<{id:string}>('/groups',{method:'POST',body:JSON.stringify(input)}),
    getGroup:(id:string)=>request<GroupDetails>(`/groups/${id}`),
    updateGroup:(id:string,input:UpdateGroupInput)=>request<void>(`/groups/${id}`,{method:'PATCH',body:JSON.stringify(input)}),
    updateGroupEvents:(id:string,input:GroupEventSettings)=>request<void>(`/groups/${id}/events`,{method:'PUT',body:JSON.stringify(input)}),
    updateGroupPreferences:(id:string,input:GroupSharePreferences)=>request<void>(`/groups/${id}/preferences`,{method:'PUT',body:JSON.stringify(input)}),
    listGroupMembers:(id:string)=>request<GroupMember[]>(`/groups/${id}/members`),
    inviteGroupMember:(id:string,username:string)=>request<void>(`/groups/${id}/invites`,{method:'POST',body:JSON.stringify({username})}),
    updateGroupMemberRole:(groupId:string,userId:string,role:'admin'|'moderator'|'member')=>request<void>(`/groups/${groupId}/members/${userId}`,{method:'PATCH',body:JSON.stringify({role})}),
    removeGroupMember:(groupId:string,userId:string)=>request<void>(`/groups/${groupId}/members/${userId}`,{method:'DELETE'}),
    transferGroupOwner:(groupId:string,userId:string)=>request<void>(`/groups/${groupId}/transfer-owner`,{method:'POST',body:JSON.stringify({userId})}),
    leaveGroup:(groupId:string)=>request<void>(`/groups/${groupId}/leave`,{method:'POST'}),
    listGroupInvites:()=>request<GroupInvite[]>('/groups/invites'),
    decideGroupInvite:(inviteId:string,decision:'accepted'|'declined')=>request<void>(`/groups/invites/${inviteId}`,{method:'PATCH',body:JSON.stringify({decision})}),
    listGroupPosts:(groupId:string,before?:string)=>request<{items:GroupPost[];nextCursor:string|null}>(`/groups/${groupId}/posts${before?`?before=${encodeURIComponent(before)}`:''}`),
    createGroupPost:(groupId:string,input:CreateGroupPostInput)=>request<{id:string}>(`/groups/${groupId}/posts`,{method:'POST',body:JSON.stringify(input)}),
    updateGroupPost:(groupId:string,postId:string,input:UpdateGroupPostInput)=>request<void>(`/groups/${groupId}/posts/${postId}`,{method:'PATCH',body:JSON.stringify(input)}),
    deleteGroupPost:(groupId:string,postId:string)=>request<void>(`/groups/${groupId}/posts/${postId}`,{method:'DELETE'}),
    getGroupPhotoSource:async(groupId:string,postId:string)=>{
      await request(`/groups/${groupId}/posts/${postId}/photo-access`);
      const tokens=await options.getTokens?.();
      return {uri:`${options.baseUrl}/groups/${groupId}/posts/${postId}/photo`,headers:{...transportHeaders,...(tokens?{authorization:`Bearer ${tokens.accessToken}`}:{})},cacheKey:`group-photo-${groupId}-${postId}`};
    },
    reactToGroupPost:(groupId:string,postId:string,reaction:GroupReaction|null)=>request<void>(`/groups/${groupId}/posts/${postId}/reaction`,{method:'PUT',body:JSON.stringify({reaction})}),
    listGroupComments:(groupId:string,postId:string)=>request<GroupComment[]>(`/groups/${groupId}/posts/${postId}/comments`),
    createGroupComment:(groupId:string,postId:string,text:string)=>request<{id:string}>(`/groups/${groupId}/posts/${postId}/comments`,{method:'POST',body:JSON.stringify({text})}),
    updateGroupComment:(groupId:string,commentId:string,text:string)=>request<void>(`/groups/${groupId}/comments/${commentId}`,{method:'PATCH',body:JSON.stringify({text})}),
    deleteGroupComment:(groupId:string,commentId:string)=>request<void>(`/groups/${groupId}/comments/${commentId}`,{method:'DELETE'}),
    markGroupSeen:(groupId:string)=>request<void>(`/groups/${groupId}/seen`,{method:'POST'}),
    shareGroupActivity:(groupIds:string[],eventType:'workout_completed'|'cardio_completed'|'weekly_goal'|'weekly_streak',sourceType:'workout_session'|'cardio_session'|'weekly_goal',sourceId:string)=>request<{created:number}>('/groups/share-activity',{method:'POST',body:JSON.stringify({groupIds,eventType,sourceType,sourceId})}),
    listGroupNotifications:()=>request<GroupNotification[]>('/groups/notifications'),
    readGroupNotification:(id:string)=>request<void>(`/groups/notifications/${id}/read`,{method:'PATCH'}),
    reportGroupContent:(groupId:string,targetType:'post'|'comment',targetId:string,reason:GroupReportReason,details?:string)=>request<void>(`/groups/${groupId}/reports`,{method:'POST',body:JSON.stringify({targetType,targetId,reason,details})}),
    listGroupReports:(groupId:string)=>request<GroupReport[]>(`/groups/${groupId}/reports`),
    resolveGroupReport:(groupId:string,reportId:string,resolution:'dismissed'|'content_removed',note?:string)=>request<void>(`/groups/${groupId}/reports/${reportId}`,{method:'PATCH',body:JSON.stringify({resolution,note})}),
    listBlockedUsers:()=>request<GroupUser[]>('/users/blocked'),
    setUserBlocked:(userId:string,blocked:boolean)=>request<void>(`/users/${userId}/block`,{method:'PUT',body:JSON.stringify({blocked})}),
    listInjectables: () => request<Injectable[]>('/injectables'),
    createInjectable: (input:InjectableInput) => request<{id:string}>('/injectables', { method:'POST',body:JSON.stringify(input) }),
    updateInjectable: (id:string,input:UpdateInjectableInput) => request<void>(`/injectables/${id}`, { method:'PUT',body:JSON.stringify(input) }),
    deleteInjectable: (id:string) => request<void>(`/injectables/${id}`, { method:'DELETE' }),
    getInjectablesToday: (date:string) => request<InjectableToday>(`/injectables/today?date=${encodeURIComponent(date)}`),
    setInjectableApplication: (id:string,date:string,applied:boolean) => request<void>(`/injectables/${id}/applications`, { method:applied?'POST':'DELETE',body:JSON.stringify({date}) }),
    getInjectableEstimate: (id:string,days=30) => request<InjectableEstimate>(`/injectables/${id}/estimate?days=${days}`),
    listMentalCheckIns: (from:string,to:string) => request<MentalCheckIn[]>(`/mental-check-ins?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    createMentalCheckIn: (input:MentalCheckInInput) => request<MentalCheckIn>('/mental-check-ins', { method:'POST', body:JSON.stringify(input) }),
    updateMentalCheckIn: (id:string,input:MentalCheckInInput) => request<MentalCheckIn>(`/mental-check-ins/${id}`, { method:'PUT', body:JSON.stringify(input) }),
    deleteMentalCheckIn: (id:string) => request<void>(`/mental-check-ins/${id}`, { method:'DELETE' }),
    listCardioSessions: (date:string) => request<CardioSession[]>(`/cardio-sessions?date=${encodeURIComponent(date)}`),
    createCardioSession: (input:CardioSessionInput) => request<CardioSession>('/cardio-sessions', { method:'POST', body:JSON.stringify(input) }),
    deleteCardioSession: (id:string) => request<void>(`/cardio-sessions/${id}`, { method:'DELETE' }),
    getHomeShortcuts: () => request<HomeShortcuts>('/me/home-shortcuts'),
    saveHomeShortcuts: (input:HomeShortcuts) => request<HomeShortcuts>('/me/home-shortcuts', { method:'PUT',body:JSON.stringify(input) }),
    listFoods: () => request<Food[]>('/nutrition/foods'),
    createFood: (input: FoodInput) => request<{id:string}>('/nutrition/foods', { method:'POST', body:JSON.stringify(input) }),
    updateFood: (id:string,input:UpdateFoodInput) => request<void>(`/nutrition/foods/${id}`, { method:'PATCH', body:JSON.stringify(input) }),
    deleteFood: (id:string) => request<void>(`/nutrition/foods/${id}`, { method:'DELETE' }),
    listMeals: (date:string) => request<Meal[]>(`/nutrition/meals?date=${encodeURIComponent(date)}`),
    createMeal: (input:MealInput) => request<{id:string}>('/nutrition/meals', { method:'POST', body:JSON.stringify(input) }),
    updateMeal: (id:string,input:MealInput) => request<void>(`/nutrition/meals/${id}`, { method:'PUT', body:JSON.stringify(input) }),
    deleteMeal: (id:string) => request<void>(`/nutrition/meals/${id}`, { method:'DELETE' }),
    favoriteMeal: (id:string) => request<{id:string}>(`/nutrition/meals/${id}/favorite`, { method:'POST' }),
    listFavoriteMeals: () => request<FavoriteMeal[]>('/nutrition/favorites'),
    renameFavoriteMeal: (id:string,name:string) => request<void>(`/nutrition/favorites/${id}`, { method:'PATCH', body:JSON.stringify({name}) }),
    deleteFavoriteMeal: (id:string) => request<void>(`/nutrition/favorites/${id}`, { method:'DELETE' }),
    reuseFavoriteMeal: (id:string,date:string,time:string,multiplier:number) => request<{id:string}>(`/nutrition/favorites/${id}/use`, { method:'POST', body:JSON.stringify({date,time,multiplier}) }),
    getDailyExpenditure: (date:string) => request<DailyExpenditure|null>(`/nutrition/expenditures/${encodeURIComponent(date)}`),
    saveDailyExpenditure: (input:DailyExpenditureInput) => request<DailyExpenditure>('/nutrition/expenditures', { method:'PUT', body:JSON.stringify(input) }),
    deleteDailyExpenditure: (date:string) => request<void>(`/nutrition/expenditures/${encodeURIComponent(date)}`, { method:'DELETE' }),
    saveNutritionGoal: (input: NutritionGoalInput) => request<void>('/nutrition/goal', { method: 'PUT', body: JSON.stringify(input) }),
    getNutritionSummary: (date:string) => request<DailyNutritionSummary>(`/nutrition/summary?date=${encodeURIComponent(date)}`),
    getBodyMeasurementsPage: (query: PageQuery) => request<Page<BodyMeasurement> & { latest: BodyMeasurement[] }>(`/body-measurements/page?page=${query.page}&pageSize=${query.pageSize}`),
    getHealthItemsPage: (kind: HealthKind, query: HealthPageQuery) => request<Page<HealthItem>>(`${kind === 'medication' ? '/medications' : '/supplements'}/page?page=${query.page}&pageSize=${query.pageSize}&search=${encodeURIComponent(query.search)}&status=${query.status}`),
    listBodyMeasurements: () => request<BodyMeasurement[]>('/body-measurements'),
    createBodyMeasurement: (input:BodyMeasurementInput) => request<{id:string}>('/body-measurements', { method:'POST', body:JSON.stringify(input) }),
    updateBodyMeasurement: (id:string,input:BodyMeasurementInput) => request<void>(`/body-measurements/${id}`, { method:'PUT', body:JSON.stringify(input) }),
    deleteBodyMeasurement: (id:string) => request<void>(`/body-measurements/${id}`, { method:'DELETE' }),
    listHealthItems: (kind: HealthKind) => request<HealthItem[]>(kind === 'medication' ? '/medications' : '/supplements'),
    createHealthItem: (kind: HealthKind, input: HealthItemInput) => request<{id:string}>(kind === 'medication' ? '/medications' : '/supplements', { method: 'POST', body: JSON.stringify(input) }),
    deleteHealthItem: (kind: HealthKind, id: string) => request<void>(`${kind === 'medication' ? '/medications' : '/supplements'}/${id}`, { method: 'DELETE' }),
    updateHealthItem: (kind: HealthKind, id: string, input: UpdateHealthItemInput) => request<void>(`${kind === 'medication' ? '/medications' : '/supplements'}/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    getHealthToday: async (kind: HealthKind, date: string): Promise<HealthToday> => {
      if (kind === 'medication') {
        const daily = await request<MedicationToday>(`/medications/today?date=${encodeURIComponent(date)}`);
        return { ...daily, items: daily.items.map(({ medication, ...entry }) => ({ ...entry, item: medication })) };
      }
      const daily = await request<SupplementToday>(`/supplements/today?date=${encodeURIComponent(date)}`);
      return { ...daily, items: daily.items.map(({ supplement, ...entry }) => ({ ...entry, item: supplement })) };
    },
    setHealthIntake: (kind: HealthKind, id: string, date: string, slot: number, consumed: boolean) => request<void>(`${kind === 'medication' ? '/medications' : '/supplements'}/${id}/intakes`, { method: consumed ? 'POST' : 'DELETE', body: JSON.stringify({ date, slot }) }),
    register: (input: RegisterInput) => request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
    login: (input: LoginInput) => request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
    me: () => request<PublicUser>('/auth/me'),
    updateProfile: (input: UpdateProfileInput) => request<PublicUser>('/auth/me', { method: 'PATCH', body: JSON.stringify(input) }),
    logout: async () => {
      const tokens = await options.getTokens?.();
      if (tokens?.refreshToken) await request<void>('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: tokens.refreshToken }) }, false).catch(() => undefined);
      await options.saveTokens?.(null);
    },
    listWorkoutPlans: () => request<WorkoutPlan[]>('/workout-plans'),
    getWorkoutPlan: (id: string) => request<WorkoutPlan>(`/workout-plans/${id}`),
    createWorkoutPlan: (input: CreateWorkoutPlanInput) => request<{ id: string }>('/workout-plans', { method: 'POST', body: JSON.stringify(input) }),
    updateWorkoutPlan: (id: string, input: UpdateWorkoutPlanInput) => request<WorkoutPlan>(`/workout-plans/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
    renewWorkoutPlan: (id: string, days: number) => request<WorkoutPlan>(`/workout-plans/${id}/renew`, { method: 'POST', body: JSON.stringify({ days }) }),
    activateWorkoutPlan: (id: string) => request<void>(`/workout-plans/${id}/activate`, { method: 'POST' }),
    deactivateWorkoutPlan: (id: string) => request<void>(`/workout-plans/${id}/deactivate`, { method: 'POST' }),
    setWorkoutPlanArchived: (id: string, archived: boolean) => request<void>(`/workout-plans/${id}/archive`, { method: 'PATCH', body: JSON.stringify({ archived }) }),
    deleteWorkoutPlan: (id: string) => request<void>(`/workout-plans/${id}`, { method: 'DELETE' }),
    listCatalogExercises: (search = '') => request<CatalogExercise[]>(`/exercises?search=${encodeURIComponent(search)}`),
    listWorkoutPlanSuggestions: () => request<SuggestedWorkoutPlan[]>('/workout-plan-suggestions'),
    completeWorkout: (input: CompleteWorkoutInput) => request<{ id: string }>('/workout-sessions', { method: 'POST', body: JSON.stringify(input) }),
    listWorkoutSessions: () => request<WorkoutSession[]>('/workout-sessions'),
    getWorkoutGoal: (date: string) => request<WorkoutGoalSummary>(`/workout-goal?date=${encodeURIComponent(date)}`),
    updateWorkoutGoal: (input: WorkoutGoalInput) => request<void>('/workout-goal', { method: 'PUT', body: JSON.stringify(input) }),
    updateWorkoutSession: (id: string, input: UpdateWorkoutSessionInput) => request<void>(`/workout-sessions/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    listSupplements: () => request<Supplement[]>('/supplements'),
    createSupplement: (input: SupplementInput) => request<{id:string}>('/supplements', { method:'POST', body:JSON.stringify(input) }),
    updateSupplement: (id:string,input:UpdateSupplementInput) => request<void>(`/supplements/${id}`, { method:'PATCH', body:JSON.stringify(input) }),
    getSupplementsToday: (date:string) => request<SupplementToday>(`/supplements/today?date=${encodeURIComponent(date)}`),
    consumeSupplement: (id:string,date:string,slot:number) => request<void>(`/supplements/${id}/intakes`, { method:'POST', body:JSON.stringify({date,slot}) }),
    undoSupplementIntake: (id:string,date:string,slot:number) => request<void>(`/supplements/${id}/intakes`, { method:'DELETE', body:JSON.stringify({date,slot}) }),
  };
}
