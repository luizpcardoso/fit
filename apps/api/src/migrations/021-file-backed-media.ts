import {DataTypes,type QueryInterface} from 'sequelize';
export async function up({context}:{context:QueryInterface}){await context.addColumn('group_posts','photo_path',{type:DataTypes.STRING(80),allowNull:true});}
export async function down({context}:{context:QueryInterface}){const [rows]=await context.sequelize.query('SELECT id FROM group_posts WHERE photo_path IS NOT NULL LIMIT 1');if(rows.length)throw new Error('Migrate media back before removing photo_path');await context.removeColumn('group_posts','photo_path');}
