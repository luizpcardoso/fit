import { randomUUID } from 'node:crypto';
import { QueryTypes, Sequelize, Transaction } from 'sequelize';
import type { GroupUser, PublicUser, UpdateProfileInput, UpdateSocialProfileInput } from '@fit/contracts';

export type UserRecord = PublicUser & { passwordHash: string };
export interface AuthRepository {
  createUser(input: Omit<UserRecord, 'id'>): Promise<UserRecord>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<PublicUser | null>;
  updateProfile(id: string, input: UpdateProfileInput): Promise<PublicUser | null>;
  updateSocialProfile(id: string, input: UpdateSocialProfileInput): Promise<PublicUser | 'username_taken' | null>;
  searchSocialUsers(userId: string, username: string): Promise<GroupUser[]>;
  createSession(userId: string, tokenHash: string, expiresAt: number): Promise<void>;
  rotateSession(oldHash: string, newHash: string, expiresAt: number): Promise<PublicUser | null>;
  revokeSession(tokenHash: string): Promise<void>;
  isSessionActive(tokenHash: string, userId: string): Promise<boolean>;
  canAuthenticate(userId: string): Promise<boolean>;
}

type UserRow = { id: string; email: string; phone: string; first_name: string; last_name: string; birth_date: string | null; gender: PublicUser['gender']; estimation_sex: PublicUser['estimationSex']; height_cm: number | null; activity_level: PublicUser['activityLevel']; primary_goal: PublicUser['primaryGoal']; username:string|null;display_name:string|null;avatar_url:string|null;password_hash: string };
const mapUser = (row: UserRow): UserRecord => ({ id: row.id, email: row.email, phone: row.phone, firstName: row.first_name, lastName: row.last_name, birthDate: row.birth_date, gender: row.gender, estimationSex: row.estimation_sex, heightCm: row.height_cm, activityLevel: row.activity_level, primaryGoal: row.primary_goal,username:row.username,displayName:row.display_name,avatarUrl:row.avatar_url,passwordHash: row.password_hash });
const userColumns = 'id,email,phone,first_name,last_name,birth_date,gender,estimation_sex,height_cm,activity_level,primary_goal,username,display_name,avatar_url,password_hash';

export class SequelizeAuthRepository implements AuthRepository {
  constructor(private readonly sequelize: Sequelize) {}
  async canAuthenticate(userId:string){const [row]=await this.sequelize.query<{suspended:number;role:string;activated_at:Date|null;temporary_expires_at:Date|null}>('SELECT suspended,role,activated_at,temporary_expires_at FROM portal_accounts WHERE user_id=?',{replacements:[userId],type:QueryTypes.SELECT});return !row||(!row.suspended&&(row.role!=='professional'||Boolean(row.activated_at)||(row.temporary_expires_at!==null&&new Date(row.temporary_expires_at).getTime()>Date.now())));}
  async isSessionActive(tokenHash:string,userId:string){const [row]=await this.sequelize.query('SELECT id FROM sessions WHERE token_hash=? AND user_id=? AND revoked_at IS NULL AND expires_at>? LIMIT 1',{replacements:[tokenHash,userId,Date.now()],type:QueryTypes.SELECT});return Boolean(row);}

  async createUser(input: Omit<UserRecord, 'id'>): Promise<UserRecord> {
    const user = { id: randomUUID(), ...input };
    await this.sequelize.query(
      'INSERT INTO users (id,email,phone,first_name,last_name,username,display_name,avatar_url,password_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,NOW(),NOW())',
      { replacements: [user.id, user.email, user.phone, user.firstName, user.lastName,user.username,user.displayName,user.avatarUrl,user.passwordHash], type: QueryTypes.INSERT },
    );
    return user;
  }
  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const rows = await this.sequelize.query<UserRow>(`SELECT ${userColumns} FROM users WHERE email=? LIMIT 1`, { replacements: [email], type: QueryTypes.SELECT });
    return rows[0] ? mapUser(rows[0]) : null;
  }
  async findUserById(id: string, transaction?: Transaction): Promise<PublicUser | null> {
    const rows = await this.sequelize.query<UserRow>(`SELECT ${userColumns} FROM users WHERE id=? LIMIT 1`, { replacements: [id], type: QueryTypes.SELECT, transaction });
    if (!rows[0]) return null;
    const { passwordHash: _, ...user } = mapUser(rows[0]); return user;
  }
  async updateProfile(id: string, input: UpdateProfileInput): Promise<PublicUser | null> {
    const fields: Array<[string, unknown]> = [];
    if ('birthDate' in input) fields.push(['birth_date', input.birthDate]);
    if ('gender' in input) fields.push(['gender', input.gender]);
    if ('estimationSex' in input) fields.push(['estimation_sex', input.estimationSex]);
    if ('heightCm' in input) fields.push(['height_cm', input.heightCm]);
    if ('activityLevel' in input) fields.push(['activity_level', input.activityLevel]);
    if ('primaryGoal' in input) fields.push(['primary_goal', input.primaryGoal]);
    if (!fields.length) return this.findUserById(id);
    await this.sequelize.query(`UPDATE users SET ${fields.map(([field]) => `${field}=?`).join(',')},updated_at=NOW() WHERE id=?`, { replacements: [...fields.map(([, value]) => value), id], type: QueryTypes.UPDATE });
    return this.findUserById(id);
  }
  async updateSocialProfile(id:string,input:UpdateSocialProfileInput):Promise<PublicUser|'username_taken'|null>{
    if(input.username){const rows=await this.sequelize.query<{id:string}>('SELECT id FROM users WHERE username=? AND id<>? LIMIT 1',{replacements:[input.username,id],type:QueryTypes.SELECT});if(rows[0])return 'username_taken';}
    const fields:Array<[string,unknown]>=[];if('username'in input)fields.push(['username',input.username]);if('displayName'in input)fields.push(['display_name',input.displayName]);if('avatarUrl'in input)fields.push(['avatar_url',input.avatarUrl]);
    if(fields.length)await this.sequelize.query(`UPDATE users SET ${fields.map(([field])=>`${field}=?`).join(',')},updated_at=NOW() WHERE id=?`,{replacements:[...fields.map(([,value])=>value),id],type:QueryTypes.UPDATE});
    return this.findUserById(id);
  }
  async searchSocialUsers(userId:string,username:string):Promise<GroupUser[]>{return this.sequelize.query<GroupUser>('SELECT id,username,COALESCE(display_name,CONCAT(first_name,\' \',last_name)) displayName,avatar_url avatarUrl FROM users WHERE username LIKE ? AND id<>? ORDER BY username LIMIT 10',{replacements:[`${username}%`,userId],type:QueryTypes.SELECT});}
  async createSession(userId: string, tokenHash: string, expiresAt: number, transaction?: Transaction): Promise<void> {
    await this.sequelize.query('INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at,updated_at) VALUES (?,?,?,?,NOW(),NOW())', { replacements: [randomUUID(), userId, tokenHash, expiresAt], type: QueryTypes.INSERT, transaction });
  }
  async rotateSession(oldHash: string, newHash: string, expiresAt: number): Promise<PublicUser | null> {
    return this.sequelize.transaction(async (transaction) => {
      const rows = await this.sequelize.query<{ id: string; user_id: string; expires_at: string; revoked_at: number | null }>('SELECT id,user_id,expires_at,revoked_at FROM sessions WHERE token_hash=? LIMIT 1 FOR UPDATE', { replacements: [oldHash], type: QueryTypes.SELECT, transaction });
      const session = rows[0];
      if (!session || session.revoked_at || Number(session.expires_at) <= Date.now()) return null;
      await this.sequelize.query('UPDATE sessions SET revoked_at=?,updated_at=NOW() WHERE id=?', { replacements: [Date.now(), session.id], type: QueryTypes.UPDATE, transaction });
      await this.createSession(session.user_id, newHash, expiresAt, transaction);
      return this.findUserById(session.user_id, transaction);
    });
  }
  async revokeSession(tokenHash: string): Promise<void> {
    await this.sequelize.query('UPDATE sessions SET revoked_at=?,updated_at=NOW() WHERE token_hash=? AND revoked_at IS NULL', { replacements: [Date.now(), tokenHash], type: QueryTypes.UPDATE });
  }
}

export class MemoryAuthRepository implements AuthRepository {
  private users = new Map<string, UserRecord>(); private sessions = new Map<string, { userId: string; expiresAt: number; revoked: boolean }>();
  async canAuthenticate(_userId:string){return true;}
  async isSessionActive(tokenHash:string,userId:string){const session=this.sessions.get(tokenHash);return Boolean(session&&session.userId===userId&&!session.revoked&&session.expiresAt>Date.now());}
  async createUser(input: Omit<UserRecord, 'id'>) { const user = { id: randomUUID(), ...input }; this.users.set(user.id, user); return user; }
  async findUserByEmail(email: string) { return [...this.users.values()].find((user) => user.email === email) ?? null; }
  async findUserById(id: string) { const value = this.users.get(id); if (!value) return null; const { passwordHash: _, ...user } = value; return user; }
  async updateProfile(id: string, input: UpdateProfileInput) { const user = this.users.get(id); if (!user) return null; Object.assign(user, input); return this.findUserById(id); }
  async updateSocialProfile(id:string,input:UpdateSocialProfileInput){const user=this.users.get(id);if(!user)return null;if(input.username&&[...this.users.values()].some(item=>item.id!==id&&item.username===input.username))return 'username_taken' as const;Object.assign(user,input);return this.findUserById(id);}
  async searchSocialUsers(userId:string,username:string){return[...this.users.values()].filter(user=>user.id!==userId&&user.username?.startsWith(username)).slice(0,10).map(user=>({id:user.id,username:user.username,displayName:user.displayName??`${user.firstName} ${user.lastName}`,avatarUrl:user.avatarUrl}));}
  async createSession(userId: string, tokenHash: string, expiresAt: number) { this.sessions.set(tokenHash, { userId, expiresAt, revoked: false }); }
  async rotateSession(oldHash: string, newHash: string, expiresAt: number) { const session = this.sessions.get(oldHash); if (!session || session.revoked || session.expiresAt <= Date.now()) return null; session.revoked = true; await this.createSession(session.userId, newHash, expiresAt); return this.findUserById(session.userId); }
  async revokeSession(tokenHash: string) { const session = this.sessions.get(tokenHash); if (session) session.revoked = true; }
}
