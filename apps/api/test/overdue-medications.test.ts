import test from 'node:test';
import assert from 'node:assert/strict';
import { overdueMedicationCount } from '../src/daily-summary-routes.js';
import { dailySummaryContent } from '../../mobile/src/utils/daily-summary-content.js';
import type { DailySummary } from '@fit/contracts';
test('alerta só conta horários passados de hoje sem registro, usando Bahia', () => {
 const now = new Date('2026-11-02T15:00:00Z');
 const items = [{time:'11:59',consumedAt:null},{time:'12:00',consumedAt:null},{time:'12:01',consumedAt:null},{time:'08:00',consumedAt:'2026-11-02T11:00:00Z'},{time:null,consumedAt:null}];
 assert.equal(overdueMedicationCount('2026-11-02',items,now),1);
 assert.equal(overdueMedicationCount('2026-11-01',items,now),0);
 assert.equal(overdueMedicationCount('2026-11-03',items,now),0);
 assert.equal(overdueMedicationCount('2026-11-02',[{time:'08:00',consumedAt:'done'}],now),0);
});
test('card indica atraso sem nomes/doses e retira aviso quando não há pendência', () => {
 const summary: DailySummary = {date:'2026-11-02',updatedAt:'2026-11-02T15:00:00Z',checks:{total:1,completed:0},nutrition:{consumedCalories:0,targetCalories:null,balance:null},pending:'checks',overdueMedications:1};
 assert.match(dailySummaryContent(summary).title,/⚠️/);
 assert.match(dailySummaryContent(summary).body,/horário de medicamento passou sem registro/);
 assert.doesNotMatch(dailySummaryContent({...summary,overdueMedications:0}).title,/⚠️/);
 assert.doesNotMatch(dailySummaryContent({...summary,overdueMedications:undefined}).body,/horário de medicamento passou/);
});
