import { DataTypes, type QueryInterface } from 'sequelize';
export async function up({ context: q }: { context: QueryInterface }) {
  await q.addColumn('group_comments', 'parent_comment_id', {type:DataTypes.STRING(36),allowNull:true});
  await q.addIndex('group_comments',['parent_comment_id'],{name:'group_comments_parent_idx'});
  await q.createTable('group_comment_reactions', {
    id:{type:DataTypes.STRING(36),primaryKey:true},
    comment_id:{type:DataTypes.STRING(36),allowNull:false,references:{model:'group_comments',key:'id'},onDelete:'CASCADE'},
    user_id:{type:DataTypes.STRING(36),allowNull:false,references:{model:'users',key:'id'},onDelete:'CASCADE'},
    reaction:{type:DataTypes.ENUM('like','love','strength','fire','applause'),allowNull:false},
    created_at:{type:DataTypes.DATE(6),allowNull:false},updated_at:{type:DataTypes.DATE(6),allowNull:false},
  });
  await q.addIndex('group_comment_reactions',['comment_id','user_id'],{name:'group_comment_reactions_uq',unique:true});
}
export async function down({ context: q }: { context: QueryInterface }) {
  await q.dropTable('group_comment_reactions');
  await q.removeColumn('group_comments','parent_comment_id');
}
