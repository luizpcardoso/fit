import { QueryTypes, type Sequelize } from 'sequelize';
import { homeShortcutsInputSchema, type HomeShortcut, type HomeShortcuts } from '@fit/contracts';

const defaults: HomeShortcut[] = ['workout', 'meal', 'cardio', 'weight', 'mental'];
type ShortcutRow = { items_json: string };

export class ShortcutRepository {
  constructor(private db: Sequelize) {}

  async get(userId: string): Promise<HomeShortcuts> {
    const [row] = await this.db.query<ShortcutRow>('SELECT items_json FROM home_shortcuts WHERE user_id=?', { replacements:[userId],type:QueryTypes.SELECT });
    if (!row) return { items: defaults };
    try { const parsed=homeShortcutsInputSchema.safeParse({items:JSON.parse(row.items_json)});return parsed.success?parsed.data:{items:defaults}; } catch { return { items: defaults }; }
  }

  async save(userId: string, input: HomeShortcuts): Promise<HomeShortcuts> {
    await this.db.query('INSERT INTO home_shortcuts (user_id,items_json,created_at,updated_at) VALUES (?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE items_json=VALUES(items_json),updated_at=UTC_TIMESTAMP()', { replacements:[userId,JSON.stringify(input.items)],type:QueryTypes.INSERT });
    return input;
  }
}
