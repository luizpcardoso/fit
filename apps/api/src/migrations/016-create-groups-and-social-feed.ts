import type { QueryInterface } from 'sequelize';
import { DataTypes } from 'sequelize';

export async function up({ context }: { context: QueryInterface }) {
  await context.addColumn('users', 'username', { type: DataTypes.STRING(30), allowNull: true, unique: true });
  await context.addColumn('users', 'display_name', { type: DataTypes.STRING(80), allowNull: true });
  await context.addColumn('users', 'avatar_url', { type: DataTypes.STRING(500), allowNull: true });

  await context.createTable('groups', {
    id:{type:DataTypes.STRING(36),primaryKey:true},owner_user_id:{type:DataTypes.STRING(36),allowNull:false,references:{model:'users',key:'id'}},name:{type:DataTypes.STRING(80),allowNull:false},description:{type:DataTypes.STRING(500),allowNull:true},avatar_url:{type:DataTypes.STRING(500),allowNull:true},posting_mode:{type:DataTypes.ENUM('all_members','admins_only'),allowNull:false,defaultValue:'all_members'},comments_enabled:{type:DataTypes.BOOLEAN,allowNull:false,defaultValue:true},active:{type:DataTypes.BOOLEAN,allowNull:false,defaultValue:true},created_at:{type:DataTypes.DATE(6),allowNull:false},updated_at:{type:DataTypes.DATE(6),allowNull:false},deactivated_at:{type:DataTypes.DATE(6),allowNull:true},
  });
  await context.createTable('group_members', {
    id:{type:DataTypes.STRING(36),primaryKey:true},group_id:{type:DataTypes.STRING(36),allowNull:false,references:{model:'groups',key:'id'},onDelete:'CASCADE'},user_id:{type:DataTypes.STRING(36),allowNull:false,references:{model:'users',key:'id'},onDelete:'CASCADE'},role:{type:DataTypes.ENUM('owner','admin','moderator','member'),allowNull:false},status:{type:DataTypes.ENUM('active','left','removed'),allowNull:false,defaultValue:'active'},joined_at:{type:DataTypes.DATE(6),allowNull:false},left_at:{type:DataTypes.DATE(6),allowNull:true},last_seen_at:{type:DataTypes.DATE(6),allowNull:true},created_at:{type:DataTypes.DATE(6),allowNull:false},updated_at:{type:DataTypes.DATE(6),allowNull:false},
  });
  await context.addIndex('group_members',['group_id','user_id'],{name:'group_members_group_user_uq',unique:true});
  await context.addIndex('group_members',['user_id','status'],{name:'group_members_user_status_idx'});
  await context.createTable('group_invites', {
    id:{type:DataTypes.STRING(36),primaryKey:true},group_id:{type:DataTypes.STRING(36),allowNull:false,references:{model:'groups',key:'id'},onDelete:'CASCADE'},invited_user_id:{type:DataTypes.STRING(36),allowNull:false,references:{model:'users',key:'id'},onDelete:'CASCADE'},invited_by_user_id:{type:DataTypes.STRING(36),allowNull:false,references:{model:'users',key:'id'}},status:{type:DataTypes.ENUM('pending','accepted','declined','cancelled','expired'),allowNull:false,defaultValue:'pending'},expires_at:{type:DataTypes.DATE(6),allowNull:false},responded_at:{type:DataTypes.DATE(6),allowNull:true},created_at:{type:DataTypes.DATE(6),allowNull:false},updated_at:{type:DataTypes.DATE(6),allowNull:false},
  });
  await context.addIndex('group_invites',['group_id','invited_user_id','status'],{name:'group_invites_lookup_idx'});
  await context.createTable('group_event_settings', {
    group_id:{type:DataTypes.STRING(36),primaryKey:true,references:{model:'groups',key:'id'},onDelete:'CASCADE'},workout_completed:{type:DataTypes.BOOLEAN,allowNull:false,defaultValue:true},cardio_completed:{type:DataTypes.BOOLEAN,allowNull:false,defaultValue:true},weekly_goal:{type:DataTypes.BOOLEAN,allowNull:false,defaultValue:true},weekly_streak:{type:DataTypes.BOOLEAN,allowNull:false,defaultValue:true},member_joined:{type:DataTypes.BOOLEAN,allowNull:false,defaultValue:true},updated_at:{type:DataTypes.DATE(6),allowNull:false},
  });
  await context.createTable('group_share_preferences', {
    group_id:{type:DataTypes.STRING(36),allowNull:false,references:{model:'groups',key:'id'},onDelete:'CASCADE'},user_id:{type:DataTypes.STRING(36),allowNull:false,references:{model:'users',key:'id'},onDelete:'CASCADE'},workout_completed:{type:DataTypes.BOOLEAN,allowNull:false,defaultValue:false},cardio_completed:{type:DataTypes.BOOLEAN,allowNull:false,defaultValue:false},weekly_goal:{type:DataTypes.BOOLEAN,allowNull:false,defaultValue:false},weekly_streak:{type:DataTypes.BOOLEAN,allowNull:false,defaultValue:false},updated_at:{type:DataTypes.DATE(6),allowNull:false},
  });
  await context.addIndex('group_share_preferences',['group_id','user_id'],{name:'group_share_preferences_uq',unique:true});
  await context.createTable('group_posts', {
    id:{type:DataTypes.STRING(36),primaryKey:true},group_id:{type:DataTypes.STRING(36),allowNull:false,references:{model:'groups',key:'id'},onDelete:'CASCADE'},author_user_id:{type:DataTypes.STRING(36),allowNull:false,references:{model:'users',key:'id'}},kind:{type:DataTypes.ENUM('manual','event','announcement'),allowNull:false},event_type:{type:DataTypes.ENUM('workout_completed','cardio_completed','weekly_goal','weekly_streak','member_joined'),allowNull:true},text:{type:DataTypes.TEXT,allowNull:true},photo_mime:{type:DataTypes.STRING(20),allowNull:true},photo_data:{type:DataTypes.BLOB('long'),allowNull:true},comments_enabled:{type:DataTypes.BOOLEAN,allowNull:false,defaultValue:true},source_type:{type:DataTypes.STRING(40),allowNull:true},source_id:{type:DataTypes.STRING(36),allowNull:true},deleted_at:{type:DataTypes.DATE(6),allowNull:true},removed_by_user_id:{type:DataTypes.STRING(36),allowNull:true,references:{model:'users',key:'id'}},created_at:{type:DataTypes.DATE(6),allowNull:false},updated_at:{type:DataTypes.DATE(6),allowNull:false},
  });
  await context.addIndex('group_posts',['group_id','created_at'],{name:'group_posts_feed_idx'});
  await context.addIndex('group_posts',['group_id','source_type','source_id'],{name:'group_posts_source_uq',unique:true});
  await context.createTable('group_post_reactions', {
    id:{type:DataTypes.STRING(36),primaryKey:true},post_id:{type:DataTypes.STRING(36),allowNull:false,references:{model:'group_posts',key:'id'},onDelete:'CASCADE'},user_id:{type:DataTypes.STRING(36),allowNull:false,references:{model:'users',key:'id'},onDelete:'CASCADE'},reaction:{type:DataTypes.ENUM('like','love','strength','fire','applause'),allowNull:false},created_at:{type:DataTypes.DATE(6),allowNull:false},updated_at:{type:DataTypes.DATE(6),allowNull:false},
  });
  await context.addIndex('group_post_reactions',['post_id','user_id'],{name:'group_post_reactions_uq',unique:true});
  await context.createTable('group_comments', {
    id:{type:DataTypes.STRING(36),primaryKey:true},post_id:{type:DataTypes.STRING(36),allowNull:false,references:{model:'group_posts',key:'id'},onDelete:'CASCADE'},author_user_id:{type:DataTypes.STRING(36),allowNull:false,references:{model:'users',key:'id'}},text:{type:DataTypes.STRING(1000),allowNull:false},deleted_at:{type:DataTypes.DATE(6),allowNull:true},removed_by_user_id:{type:DataTypes.STRING(36),allowNull:true,references:{model:'users',key:'id'}},created_at:{type:DataTypes.DATE(6),allowNull:false},updated_at:{type:DataTypes.DATE(6),allowNull:false},
  });
  await context.addIndex('group_comments',['post_id','created_at'],{name:'group_comments_post_idx'});
  await context.createTable('group_notifications', {
    id:{type:DataTypes.STRING(36),primaryKey:true},user_id:{type:DataTypes.STRING(36),allowNull:false,references:{model:'users',key:'id'},onDelete:'CASCADE'},type:{type:DataTypes.ENUM('invite','comment','role_changed','removed','report_resolved'),allowNull:false},title:{type:DataTypes.STRING(120),allowNull:false},message:{type:DataTypes.STRING(300),allowNull:false},group_id:{type:DataTypes.STRING(36),allowNull:true,references:{model:'groups',key:'id'},onDelete:'CASCADE'},post_id:{type:DataTypes.STRING(36),allowNull:true,references:{model:'group_posts',key:'id'},onDelete:'CASCADE'},read_at:{type:DataTypes.DATE(6),allowNull:true},created_at:{type:DataTypes.DATE(6),allowNull:false},
  });
  await context.addIndex('group_notifications',['user_id','read_at','created_at'],{name:'group_notifications_user_idx'});
  await context.createTable('group_reports', {
    id:{type:DataTypes.STRING(36),primaryKey:true},group_id:{type:DataTypes.STRING(36),allowNull:false,references:{model:'groups',key:'id'},onDelete:'CASCADE'},reporter_user_id:{type:DataTypes.STRING(36),allowNull:false,references:{model:'users',key:'id'}},target_type:{type:DataTypes.ENUM('post','comment'),allowNull:false},target_id:{type:DataTypes.STRING(36),allowNull:false},reason:{type:DataTypes.ENUM('harassment','offensive','spam','sexual','privacy','dangerous','other'),allowNull:false},details:{type:DataTypes.STRING(500),allowNull:true},status:{type:DataTypes.ENUM('pending','dismissed','content_removed'),allowNull:false,defaultValue:'pending'},resolved_by_user_id:{type:DataTypes.STRING(36),allowNull:true,references:{model:'users',key:'id'}},resolution_note:{type:DataTypes.STRING(500),allowNull:true},created_at:{type:DataTypes.DATE(6),allowNull:false},resolved_at:{type:DataTypes.DATE(6),allowNull:true},
  });
  await context.addIndex('group_reports',['group_id','status','created_at'],{name:'group_reports_queue_idx'});
  await context.addIndex('group_reports',['reporter_user_id','target_type','target_id'],{name:'group_reports_reporter_target_uq',unique:true});
  await context.createTable('user_blocks', {
    blocker_user_id:{type:DataTypes.STRING(36),allowNull:false,references:{model:'users',key:'id'},onDelete:'CASCADE'},blocked_user_id:{type:DataTypes.STRING(36),allowNull:false,references:{model:'users',key:'id'},onDelete:'CASCADE'},created_at:{type:DataTypes.DATE(6),allowNull:false},
  });
  await context.addIndex('user_blocks',['blocker_user_id','blocked_user_id'],{name:'user_blocks_uq',unique:true});
}

export async function down({ context }: { context: QueryInterface }) {
  for (const table of ['user_blocks','group_reports','group_notifications','group_comments','group_post_reactions','group_posts','group_share_preferences','group_event_settings','group_invites','group_members','groups']) await context.dropTable(table);
  await context.removeColumn('users','avatar_url'); await context.removeColumn('users','display_name'); await context.removeColumn('users','username');
}
