import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { localDate } from '@/utils/dates';
import { dateInputToIso, formatDateInput, isoDateToInput } from '@/utils/date-input';
import { formatTimeInput } from '@/utils/input-format';
import { mealClock, resolveMealWhen } from '@/utils/meal-time';

type Selection = { mode: 'now' | 'custom'; dateInput: string; customTime: string; timeEdited: boolean; nowExplicit: boolean };
const frozenDate = (value: Selection) => value.mode === 'now' ? isoDateToInput(localDate()) : value.dateInput;

export function useMealWhen(date: string, initialTime?: string, preserveInitialTime = true) {
  const [now, setNow] = useState(() => new Date());
  const [selection, setSelection] = useState<Selection>(() => ({ mode: initialTime || date !== localDate() ? 'custom' : 'now', dateInput: isoDateToInput(date), customTime: initialTime ?? mealClock(), timeEdited: Boolean(initialTime) && preserveInitialTime, nowExplicit: false }));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => { setNow(new Date()); timer = setTimeout(tick, 60050 - Date.now() % 60000); };
    timer = setTimeout(tick, 60050 - Date.now() % 60000);
    const sub = AppState.addEventListener('change', state => { if (state === 'active') setNow(new Date()); });
    return () => { clearTimeout(timer); sub.remove(); };
  }, []);
  const setDateInput = useCallback((value: string) => setSelection(current => ({ ...current, dateInput: formatDateInput(value), mode: 'custom', nowExplicit: false })), []);
  const chooseNow = useCallback(() => {
    setNow(new Date());
    setSelection(current => ({ ...current, dateInput: isoDateToInput(localDate()), mode: 'now', nowExplicit: true }));
  }, []);
  const chooseCustom = useCallback(() => setSelection(current => ({ ...current, dateInput: frozenDate(current), customTime: current.mode === 'now' && !current.timeEdited && !current.nowExplicit ? mealClock() : current.customTime, mode: 'custom', nowExplicit: false })), []);
  const setTime = useCallback((value: string) => setSelection(current => ({ ...current, dateInput: frozenDate(current), customTime: formatTimeInput(value), mode: 'custom', timeEdited: true, nowExplicit: false })), []);
  const suggest = useCallback((time: string, force = false) => setSelection(current => {
    if (!force && current.timeEdited) return current;
    const custom = force || !current.nowExplicit;
    return { ...current, dateInput: custom ? frozenDate(current) : current.dateInput, customTime: time, mode: custom ? 'custom' : current.mode, timeEdited: false, nowExplicit: custom ? false : current.nowExplicit };
  }), []);
  const resetTime = useCallback((time?: string | null) => setSelection(current => ({ ...current, dateInput: frozenDate(current), customTime: time || mealClock(), mode: time || dateInputToIso(frozenDate(current)) !== localDate() ? 'custom' : 'now', timeEdited: false, nowExplicit: false })), []);
  const resolve = useCallback(() => resolveMealWhen(selection.mode, selection.dateInput, selection.customTime), [selection]);
  return { ...selection, now, date: selection.mode === 'now' ? localDate(now) : dateInputToIso(selection.dateInput), time: selection.mode === 'now' ? mealClock(now) : selection.customTime, dateInput: selection.mode === 'now' ? isoDateToInput(localDate(now)) : selection.dateInput, canUseNow: selection.mode === 'now' || dateInputToIso(selection.dateInput) === localDate(now), setDateInput, chooseNow, chooseCustom, setTime, suggest, resetTime, resolve };
}
