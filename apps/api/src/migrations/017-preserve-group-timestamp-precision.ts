import { DataTypes, type QueryInterface } from "sequelize";

const requiredColumns: Record<string, string[]> = {
  groups: ["created_at", "updated_at"],
  group_members: ["joined_at", "created_at", "updated_at"],
  group_invites: ["expires_at", "created_at", "updated_at"],
  group_event_settings: ["updated_at"],
  group_share_preferences: ["updated_at"],
  group_posts: ["created_at", "updated_at"],
  group_post_reactions: ["created_at", "updated_at"],
  group_comments: ["created_at", "updated_at"],
  group_notifications: ["created_at"],
  group_reports: ["created_at"],
  user_blocks: ["created_at"],
};

const optionalColumns: Record<string, string[]> = {
  groups: ["deactivated_at"],
  group_members: ["left_at", "last_seen_at"],
  group_invites: ["responded_at"],
  group_posts: ["deleted_at"],
  group_comments: ["deleted_at"],
  group_notifications: ["read_at"],
  group_reports: ["resolved_at"],
};

async function changePrecision(context: QueryInterface, precision?: number) {
  const dateType = precision === undefined ? DataTypes.DATE : DataTypes.DATE(precision);
  for (const [table, columns] of Object.entries(requiredColumns)) {
    for (const column of columns) {
      await context.changeColumn(table, column, {
        type: dateType,
        allowNull: false,
      });
    }
  }
  for (const [table, columns] of Object.entries(optionalColumns)) {
    for (const column of columns) {
      await context.changeColumn(table, column, {
        type: dateType,
        allowNull: true,
      });
    }
  }
}

export async function up({ context }: { context: QueryInterface }) {
  await changePrecision(context, 6);
}

export async function down({ context }: { context: QueryInterface }) {
  await changePrecision(context);
}
