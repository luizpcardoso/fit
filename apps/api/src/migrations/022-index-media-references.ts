import type {QueryInterface} from 'sequelize';
export async function up({context}:{context:QueryInterface}){await context.addIndex('group_posts',['photo_path'],{name:'group_posts_photo_path_idx'});}
export async function down({context}:{context:QueryInterface}){await context.removeIndex('group_posts','group_posts_photo_path_idx');}
