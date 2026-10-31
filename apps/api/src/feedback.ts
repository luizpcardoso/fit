import {randomUUID} from 'node:crypto';
import {QueryTypes,type Sequelize} from 'sequelize';
import type {FeedbackInput} from '@fit/contracts';
export interface FeedbackStore {create(userId:string,input:FeedbackInput):Promise<string>}
export class FeedbackRepository implements FeedbackStore {
  constructor(private db:Sequelize){}
  async create(userId:string,input:FeedbackInput){const id=randomUUID();await this.db.query('INSERT INTO user_feedback (id,user_id,category,message,created_at) VALUES (?,?,?,?,UTC_TIMESTAMP())',{replacements:[id,userId,input.category,input.message],type:QueryTypes.INSERT});return id;}
}
