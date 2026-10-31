import {DataTypes,type QueryInterface} from 'sequelize';
export async function up({context}:{context:QueryInterface}){await context.changeColumn('users','avatar_url',{type:DataTypes.TEXT('medium'),allowNull:true});}
export async function down({context}:{context:QueryInterface}){const [rows]=await context.sequelize.query('SELECT id FROM users WHERE LENGTH(avatar_url)>500 LIMIT 1');if(rows.length)throw new Error('Remove oversized avatars before downgrade');await context.changeColumn('users','avatar_url',{type:DataTypes.STRING(500),allowNull:true});}
