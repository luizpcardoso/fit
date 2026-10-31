import { QueryTypes, type QueryInterface } from 'sequelize';

const formatMinutes = (minutes: number) => { const normalized = ((minutes % 1440) + 1440) % 1440; return `${String(Math.floor(normalized / 60)).padStart(2,'0')}:${String(normalized % 60).padStart(2,'0')}`; };
const suggestTimes = (frequency: number) => Array.from({ length: frequency }, (_, index) => formatMinutes(Math.round((420 + index * 1440 / frequency) / 30) * 30));

export async function up({ context }: { context: QueryInterface }) {
  const rows = await context.sequelize.query<{ id:string; daily_frequency:number; times:string[]|string }>('SELECT id,daily_frequency,times FROM supplements', { type:QueryTypes.SELECT });
  for (const row of rows) {
    const frequency = Math.min(6, Math.max(1, Number(row.daily_frequency) || 1));
    let times:string[]=[]; try { times=Array.isArray(row.times)?row.times:JSON.parse(row.times); } catch { /* normalizado abaixo */ }
    const valid = times.length===frequency && new Set(times).size===times.length && times.every(time=>/^([01]\d|2[0-3]):[0-5]\d$/.test(time));
    if (!valid || frequency!==row.daily_frequency) await context.sequelize.query('UPDATE supplements SET daily_frequency=?,times=?,updated_at=NOW() WHERE id=?', { replacements:[frequency,JSON.stringify(suggestTimes(frequency)),row.id], type:QueryTypes.UPDATE });
  }
}
export async function down() { /* Normalização de dados não é revertida para valores inválidos. */ }
