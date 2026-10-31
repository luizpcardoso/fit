import { randomUUID } from "node:crypto";
import { QueryTypes, type Sequelize, type Transaction } from "sequelize";
import sharp from "sharp";
import {saveMedia,readMedia,removeMedia} from './media-storage.js';
import type {
  CreateGroupCommentInput,
  CreateGroupInput,
  CreateGroupPostInput,
  GroupComment,
  GroupDashboard,
  GroupDetails,
  GroupEventSettings,
  GroupEventType,
  GroupInvite,
  GroupMember,
  GroupNotification,
  GroupPost,
  GroupReaction,
  GroupReport,
  GroupReportReason,
  GroupRole,
  GroupSharePreferences,
  GroupSummary,
  GroupUser,
  UpdateGroupInput,
  UpdateGroupPostInput,
} from "@fit/contracts";

// Notifications are shown verbatim, so roles must be human-readable.
const roleLabels = { owner: 'Proprietário', admin: 'Administração', moderator: 'Moderação', member: 'Membro' } as const;

type Membership = {
  group_id: string;
  user_id: string;
  role: GroupRole;
  joined_at: Date;
};
const eventDefaults: GroupEventSettings = {
  workout_completed: true,
  cardio_completed: true,
  weekly_goal: true,
  weekly_streak: true,
  member_joined: true,
};
const preferenceDefaults: GroupSharePreferences = {
  workout_completed: false,
  cardio_completed: false,
  weekly_goal: false,
  weekly_streak: false,
};
const privileged = (role: GroupRole) => role === "owner" || role === "admin";
const moderator = (role: GroupRole) => privileged(role) || role === "moderator";
const iso = (value: Date | string) => new Date(value).toISOString();

export class GroupRepository {
  constructor(private readonly db: Sequelize) {}
  async purgeExpiredPhotos(){
    const expired=await this.db.query<{id:string;photo_path:string|null}>("SELECT id,photo_path FROM group_posts WHERE (photo_data IS NOT NULL OR photo_path IS NOT NULL) AND (deleted_at IS NOT NULL OR created_at<=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 48 HOUR))",{type:QueryTypes.SELECT});
    for(const post of expired){await this.db.query('DELETE FROM group_posts WHERE id=?',{replacements:[post.id],type:QueryTypes.DELETE});if(post.photo_path){const [remaining]=await this.db.query<{id:string}>('SELECT id FROM group_posts WHERE photo_path=? LIMIT 1',{replacements:[post.photo_path],type:QueryTypes.SELECT});if(!remaining)await removeMedia(post.photo_path);}}
  }
  async migratePhotos(){const rows=await this.db.query<{id:string;photo_data:Buffer}>('SELECT id,photo_data FROM group_posts WHERE photo_data IS NOT NULL LIMIT 20',{type:QueryTypes.SELECT});for(const row of rows){const key=await saveMedia(row.photo_data);try{await this.db.query('UPDATE group_posts SET photo_path=?,photo_data=NULL WHERE id=?',{replacements:[key,row.id],type:QueryTypes.UPDATE});}catch(error){await removeMedia(key);throw error;}}return rows.length;}
  async publishToGroups(userId:string,groupIds:string[],input:CreateGroupPostInput){
    const processed=input.photoDataUrl?await this.photo(input.photoDataUrl):null;
    if(input.photoDataUrl&&!processed)return 'invalid_photo';
    const ids=[...new Set(groupIds)];
    for(const id of ids){const group=await this.get(userId,id);if(!group)return 'missing';if(!group.active||group.postingMode==='admins_only'&&!privileged(group.role))return 'forbidden';}
    const sharedPhoto=processed?{mime:processed.mime,path:await saveMedia(processed.data)}:null;
    try{return await this.db.transaction(async transaction=>{
      const created:string[]=[];
      for(const groupId of ids){const result=await this.createPost(userId,groupId,input,transaction,sharedPhoto??undefined);if(!/^[a-f0-9-]{36}$/.test(result))throw new Error('Unable to publish');created.push(result);}
      return created;
    });}catch(error){if(sharedPhoto)await removeMedia(sharedPhoto.path);throw error;}
  }
  private async membership(userId: string, groupId: string, t?: Transaction) {
    const [row] = await this.db.query<Membership>(
      "SELECT group_id,user_id,role,joined_at FROM group_members WHERE group_id=? AND user_id=? AND status='active' LIMIT 1",
      {
        replacements: [groupId, userId],
        type: QueryTypes.SELECT,
        transaction: t,
      },
    );
    return row ?? null;
  }
  private async user(id: string, t?: Transaction): Promise<GroupUser> {
    const [row] = await this.db.query<GroupUser>(
      "SELECT id,username,COALESCE(display_name,CONCAT(first_name,' ',last_name)) displayName,avatar_url avatarUrl FROM users WHERE id=?",
      { replacements: [id], type: QueryTypes.SELECT, transaction: t },
    );
    return row;
  }
  private async notify(
    userId: string,
    type: GroupNotification["type"],
    title: string,
    message: string,
    groupId: string | null,
    postId: string | null,
    t?: Transaction,
  ) {
    await this.db.query(
      "INSERT INTO group_notifications (id,user_id,type,title,message,group_id,post_id,created_at) VALUES (?,?,?,?,?,?,?,UTC_TIMESTAMP(6))",
      {
        replacements: [
          randomUUID(),
          userId,
          type,
          title,
          message,
          groupId,
          postId,
        ],
        type: QueryTypes.INSERT,
        transaction: t,
      },
    );
  }

  async create(userId: string, input: CreateGroupInput): Promise<string> {
    return this.db.transaction(async (t) => {
      const id = randomUUID();
      await this.db.query(
        "INSERT INTO `groups` (id,owner_user_id,name,description,avatar_url,posting_mode,comments_enabled,active,created_at,updated_at) VALUES (?,?,?,?,?,'all_members',1,1,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))",
        {
          replacements: [
            id,
            userId,
            input.name,
            input.description ?? null,
            input.avatarUrl ?? null,
          ],
          type: QueryTypes.INSERT,
          transaction: t,
        },
      );
      await this.db.query(
        "INSERT INTO group_members (id,group_id,user_id,role,status,joined_at,created_at,updated_at) VALUES (?,?,?,'owner','active',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))",
        {
          replacements: [randomUUID(), id, userId],
          type: QueryTypes.INSERT,
          transaction: t,
        },
      );
      await this.db.query(
        "INSERT INTO group_event_settings (group_id,workout_completed,cardio_completed,weekly_goal,weekly_streak,member_joined,updated_at) VALUES (?,1,1,1,1,1,UTC_TIMESTAMP(6))",
        { replacements: [id], type: QueryTypes.INSERT, transaction: t },
      );
      await this.db.query(
        "INSERT INTO group_share_preferences (group_id,user_id,workout_completed,cardio_completed,weekly_goal,weekly_streak,updated_at) VALUES (?,?,0,0,0,0,UTC_TIMESTAMP(6))",
        { replacements: [id, userId], type: QueryTypes.INSERT, transaction: t },
      );
      return id;
    });
  }

  async list(userId: string): Promise<GroupSummary[]> {
    const rows = await this.db.query<any>(
      `SELECT g.id,g.name,g.description,g.avatar_url avatarUrl,m.role,g.active,g.created_at createdAt,(SELECT COUNT(*) FROM group_members x WHERE x.group_id=g.id AND x.status='active') memberCount,((SELECT COUNT(*) FROM group_posts p WHERE p.group_id=g.id AND p.deleted_at IS NULL AND p.created_at>=m.joined_at AND p.created_at>COALESCE(m.last_seen_at,m.joined_at))+(SELECT COUNT(*) FROM group_comments c JOIN group_posts p ON p.id=c.post_id WHERE p.group_id=g.id AND p.created_at>=m.joined_at AND c.deleted_at IS NULL AND c.created_at>COALESCE(m.last_seen_at,m.joined_at))+(SELECT COUNT(*) FROM group_post_reactions r JOIN group_posts p ON p.id=r.post_id WHERE p.group_id=g.id AND p.created_at>=m.joined_at AND r.created_at>COALESCE(m.last_seen_at,m.joined_at))) unseenCount FROM group_members m JOIN \`groups\` g ON g.id=m.group_id WHERE m.user_id=? AND m.status='active' ORDER BY g.active DESC,g.updated_at DESC`,
      { replacements: [userId], type: QueryTypes.SELECT },
    );
    return rows.map((r: any) => ({
      ...r,
      active: Boolean(r.active),
      memberCount: Number(r.memberCount),
      unseenCount: Number(r.unseenCount),
      createdAt: iso(r.createdAt),
    }));
  }
  async get(userId: string, groupId: string): Promise<GroupDetails | null> {
    const m = await this.membership(userId, groupId);
    if (!m) return null;
    const [g] = await this.db.query<any>(
      `SELECT g.id,g.name,g.description,g.avatar_url avatarUrl,g.posting_mode postingMode,g.comments_enabled commentsEnabled,g.active,g.created_at createdAt,(SELECT COUNT(*) FROM group_members x WHERE x.group_id=g.id AND x.status='active') memberCount,(SELECT COUNT(*) FROM group_posts p WHERE p.group_id=g.id AND p.deleted_at IS NULL AND p.created_at>=(SELECT joined_at FROM group_members WHERE group_id=g.id AND user_id=? AND status='active') AND p.created_at>COALESCE((SELECT last_seen_at FROM group_members WHERE group_id=g.id AND user_id=?),(SELECT joined_at FROM group_members WHERE group_id=g.id AND user_id=? AND status='active'))) unseenCount FROM \`groups\` g WHERE g.id=?`,
      {
        replacements: [userId, userId, userId, groupId],
        type: QueryTypes.SELECT,
      },
    );
    if (!g) return null;
    const [settings] = await this.db.query<any>(
      "SELECT workout_completed,cardio_completed,weekly_goal,weekly_streak,member_joined FROM group_event_settings WHERE group_id=?",
      { replacements: [groupId], type: QueryTypes.SELECT },
    );
    const [prefs] = await this.db.query<any>(
      "SELECT workout_completed,cardio_completed,weekly_goal,weekly_streak FROM group_share_preferences WHERE group_id=? AND user_id=?",
      { replacements: [groupId, userId], type: QueryTypes.SELECT },
    );
    return {
      ...g,
      role: m.role,
      active: Boolean(g.active),
      commentsEnabled: Boolean(g.commentsEnabled),
      memberCount: Number(g.memberCount),
      unseenCount: Number(g.unseenCount),
      eventSettings: this.booleans(
        settings ?? eventDefaults,
      ) as GroupEventSettings,
      sharePreferences: this.booleans(
        prefs ?? preferenceDefaults,
      ) as GroupSharePreferences,
      joinedAt: iso(m.joined_at),
      createdAt: iso(g.createdAt),
    };
  }
  private booleans(value: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, Boolean(v)]),
    );
  }

  async update(
    userId: string,
    groupId: string,
    input: UpdateGroupInput,
  ): Promise<"ok" | "forbidden" | "missing"> {
    const m = await this.membership(userId, groupId);
    if (!m) return "missing";
    if (!privileged(m.role)) return "forbidden";
    if (input.active !== undefined && m.role !== "owner") return "forbidden";
    const fields: Array<[string, unknown]> = [];
    const map: Record<string, string> = {
      name: "name",
      description: "description",
      avatarUrl: "avatar_url",
      postingMode: "posting_mode",
      commentsEnabled: "comments_enabled",
      active: "active",
    };
    for (const [key, column] of Object.entries(map))
      if (key in input) fields.push([column, (input as any)[key]]);
    if (fields.length)
      await this.db.query(
        `UPDATE \`groups\` SET ${fields.map(([f]) => `${f}=?`).join(",")},deactivated_at=${input.active === false ? "UTC_TIMESTAMP(6)" : "deactivated_at"},updated_at=UTC_TIMESTAMP(6) WHERE id=?`,
        {
          replacements: [...fields.map(([, v]) => v), groupId],
          type: QueryTypes.UPDATE,
        },
      );
    return "ok";
  }
  async updateEvents(
    userId: string,
    groupId: string,
    input: GroupEventSettings,
  ) {
    const m = await this.membership(userId, groupId);
    if (!m) return "missing" as const;
    if (!privileged(m.role)) return "forbidden" as const;
    await this.db.query(
      "UPDATE group_event_settings SET workout_completed=?,cardio_completed=?,weekly_goal=?,weekly_streak=?,member_joined=?,updated_at=UTC_TIMESTAMP(6) WHERE group_id=?",
      {
        replacements: [
          input.workout_completed,
          input.cardio_completed,
          input.weekly_goal,
          input.weekly_streak,
          input.member_joined,
          groupId,
        ],
        type: QueryTypes.UPDATE,
      },
    );
    return "ok" as const;
  }
  async updatePreferences(
    userId: string,
    groupId: string,
    input: GroupSharePreferences,
  ) {
    const m = await this.membership(userId, groupId);
    if (!m) return "missing" as const;
    const [settings] = await this.db.query<any>(
      "SELECT workout_completed,cardio_completed,weekly_goal,weekly_streak FROM group_event_settings WHERE group_id=?",
      { replacements: [groupId], type: QueryTypes.SELECT },
    );
    for (const key of Object.keys(input) as Array<keyof GroupSharePreferences>)
      if (input[key] && !settings?.[key]) return "disabled" as const;
    await this.db.query(
      "INSERT INTO group_share_preferences (group_id,user_id,workout_completed,cardio_completed,weekly_goal,weekly_streak,updated_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE workout_completed=VALUES(workout_completed),cardio_completed=VALUES(cardio_completed),weekly_goal=VALUES(weekly_goal),weekly_streak=VALUES(weekly_streak),updated_at=UTC_TIMESTAMP(6)",
      {
        replacements: [
          groupId,
          userId,
          input.workout_completed,
          input.cardio_completed,
          input.weekly_goal,
          input.weekly_streak,
        ],
        type: QueryTypes.INSERT,
      },
    );
    return "ok" as const;
  }

  async members(
    userId: string,
    groupId: string,
  ): Promise<GroupMember[] | null> {
    if (!(await this.membership(userId, groupId))) return null;
    const rows = await this.db.query<any>(
      "SELECT u.id,u.username,COALESCE(u.display_name,CONCAT(u.first_name,' ',u.last_name)) displayName,u.avatar_url avatarUrl,m.role,m.joined_at joinedAt FROM group_members m JOIN users u ON u.id=m.user_id WHERE m.group_id=? AND m.status='active' ORDER BY FIELD(m.role,'owner','admin','moderator','member'),displayName",
      { replacements: [groupId], type: QueryTypes.SELECT },
    );
    return rows.map((r: any) => ({
      user: {
        id: r.id,
        username: r.username,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
      },
      role: r.role,
      joinedAt: iso(r.joinedAt),
    }));
  }
  async invite(userId: string, groupId: string, username: string) {
    const m = await this.membership(userId, groupId);
    if (!m) return "missing" as const;
    if (!privileged(m.role)) return "forbidden" as const;
    const [target] = await this.db.query<{ id: string }>(
      "SELECT id FROM users WHERE username=? LIMIT 1",
      { replacements: [username], type: QueryTypes.SELECT },
    );
    if (!target) return "user_missing" as const;
    if (target.id === userId) return "conflict" as const;
    const [member] = await this.db.query<{ status: string }>(
      "SELECT status FROM group_members WHERE group_id=? AND user_id=?",
      { replacements: [groupId, target.id], type: QueryTypes.SELECT },
    );
    if (member?.status === "active") return "conflict" as const;
    const [pending] = await this.db.query<{ id: string }>(
      "SELECT id FROM group_invites WHERE group_id=? AND invited_user_id=? AND status='pending' AND expires_at>UTC_TIMESTAMP(6)",
      { replacements: [groupId, target.id], type: QueryTypes.SELECT },
    );
    if (pending) return "conflict" as const;
    const [group] = await this.db.query<{ name: string }>(
      "SELECT name FROM `groups` WHERE id=? AND active=1",
      { replacements: [groupId], type: QueryTypes.SELECT },
    );
    if (!group) return "missing" as const;
    await this.db.transaction(async (t) => {
      await this.db.query(
        "INSERT INTO group_invites (id,group_id,invited_user_id,invited_by_user_id,status,expires_at,created_at,updated_at) VALUES (?,?,?,?,'pending',DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 14 DAY),UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))",
        {
          replacements: [randomUUID(), groupId, target.id, userId],
          type: QueryTypes.INSERT,
          transaction: t,
        },
      );
      await this.notify(
        target.id,
        "invite",
        "Novo convite",
        `Você foi convidado para ${group.name}.`,
        groupId,
        null,
        t,
      );
    });
    return "ok" as const;
  }
  async invites(userId: string): Promise<GroupInvite[]> {
    const rows = await this.db.query<any>(
      "SELECT i.id,i.status,i.created_at createdAt,i.expires_at expiresAt,g.id groupId,g.name groupName,g.avatar_url groupAvatar,u.id inviterId,u.username inviterUsername,COALESCE(u.display_name,CONCAT(u.first_name,' ',u.last_name)) inviterName,u.avatar_url inviterAvatar FROM group_invites i JOIN `groups` g ON g.id=i.group_id JOIN users u ON u.id=i.invited_by_user_id WHERE i.invited_user_id=? AND i.status='pending' AND i.expires_at>UTC_TIMESTAMP(6) ORDER BY i.created_at DESC",
      { replacements: [userId], type: QueryTypes.SELECT },
    );
    return rows.map((r: any) => ({
      id: r.id,
      status: r.status,
      group: { id: r.groupId, name: r.groupName, avatarUrl: r.groupAvatar },
      invitedBy: {
        id: r.inviterId,
        username: r.inviterUsername,
        displayName: r.inviterName,
        avatarUrl: r.inviterAvatar,
      },
      createdAt: iso(r.createdAt),
      expiresAt: iso(r.expiresAt),
    }));
  }
  async decideInvite(
    userId: string,
    inviteId: string,
    decision: "accepted" | "declined",
  ) {
    return this.db.transaction(async (t) => {
      const [invite] = await this.db.query<any>(
        "SELECT i.id,i.group_id,i.status,i.expires_at FROM group_invites i JOIN `groups` g ON g.id=i.group_id AND g.active=1 WHERE i.id=? AND i.invited_user_id=? FOR UPDATE",
        {
          replacements: [inviteId, userId],
          type: QueryTypes.SELECT,
          transaction: t,
        },
      );
      if (!invite) return "missing" as const;
      if (
        invite.status !== "pending" ||
        new Date(invite.expires_at) <= new Date()
      )
        return "conflict" as const;
      await this.db.query(
        "UPDATE group_invites SET status=?,responded_at=UTC_TIMESTAMP(6),updated_at=UTC_TIMESTAMP(6) WHERE id=?",
        {
          replacements: [decision, inviteId],
          type: QueryTypes.UPDATE,
          transaction: t,
        },
      );
      if (decision === "declined") return "ok" as const;
      await this.db.query(
        "INSERT INTO group_members (id,group_id,user_id,role,status,joined_at,left_at,last_seen_at,created_at,updated_at) VALUES (?,?,?,'member','active',UTC_TIMESTAMP(6),NULL,NULL,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE role='member',status='active',joined_at=UTC_TIMESTAMP(6),left_at=NULL,last_seen_at=NULL,updated_at=UTC_TIMESTAMP(6)",
        {
          replacements: [randomUUID(), invite.group_id, userId],
          type: QueryTypes.INSERT,
          transaction: t,
        },
      );
      await this.db.query(
        "INSERT INTO group_share_preferences (group_id,user_id,workout_completed,cardio_completed,weekly_goal,weekly_streak,updated_at) VALUES (?,?,0,0,0,0,UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE workout_completed=0,cardio_completed=0,weekly_goal=0,weekly_streak=0,updated_at=UTC_TIMESTAMP(6)",
        {
          replacements: [invite.group_id, userId],
          type: QueryTypes.INSERT,
          transaction: t,
        },
      );
      await this.createMemberJoined(invite.group_id, userId, invite.id, t);
      return "ok" as const;
    });
  }
  private async createMemberJoined(
    groupId: string,
    userId: string,
    inviteId: string,
    t: Transaction,
  ) {
    const [setting] = await this.db.query<{ member_joined: number }>(
      "SELECT member_joined FROM group_event_settings WHERE group_id=?",
      { replacements: [groupId], type: QueryTypes.SELECT, transaction: t },
    );
    if (!setting?.member_joined) return;
    const user = await this.user(userId, t);
    await this.db.query(
      "INSERT INTO group_posts (id,group_id,author_user_id,kind,event_type,text,comments_enabled,source_type,source_id,created_at,updated_at) VALUES (?,?,?,'event','member_joined',?,1,'membership',?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))",
      {
        replacements: [
          randomUUID(),
          groupId,
          userId,
          `${user.displayName} entrou no grupo.`,
          inviteId,
        ],
        type: QueryTypes.INSERT,
        transaction: t,
      },
    );
  }

  async changeRole(
    actorId: string,
    groupId: string,
    targetId: string,
    role: "admin" | "moderator" | "member",
  ) {
    const actor = await this.membership(actorId, groupId);
    const target = await this.membership(targetId, groupId);
    if (!actor || !target) return "missing" as const;
    if (actor.role !== "owner" || target.role === "owner")
      return "forbidden" as const;
    await this.db.query(
      "UPDATE group_members SET role=?,updated_at=UTC_TIMESTAMP(6) WHERE group_id=? AND user_id=?",
      { replacements: [role, groupId, targetId], type: QueryTypes.UPDATE },
    );
    await this.notify(
      targetId,
      "role_changed",
      "Função atualizada",
      `Sua função no grupo agora é ${roleLabels[role as keyof typeof roleLabels] ?? 'Membro'}.`,
      groupId,
      null,
    );
    return "ok" as const;
  }
  async transfer(actorId: string, groupId: string, targetId: string) {
    return this.db.transaction(async (t) => {
      const actor = await this.membership(actorId, groupId, t);
      const target = await this.membership(targetId, groupId, t);
      if (!actor || !target) return "missing" as const;
      if (actor.role !== "owner" || target.role === "owner")
        return "forbidden" as const;
      await this.db.query(
        "UPDATE group_members SET role='admin',updated_at=UTC_TIMESTAMP(6) WHERE group_id=? AND user_id=?",
        {
          replacements: [groupId, actorId],
          type: QueryTypes.UPDATE,
          transaction: t,
        },
      );
      await this.db.query(
        "UPDATE group_members SET role='owner',updated_at=UTC_TIMESTAMP(6) WHERE group_id=? AND user_id=?",
        {
          replacements: [groupId, targetId],
          type: QueryTypes.UPDATE,
          transaction: t,
        },
      );
      await this.db.query(
        "UPDATE `groups` SET owner_user_id=?,updated_at=UTC_TIMESTAMP(6) WHERE id=?",
        {
          replacements: [targetId, groupId],
          type: QueryTypes.UPDATE,
          transaction: t,
        },
      );
      return "ok" as const;
    });
  }
  async removeMember(actorId: string, groupId: string, targetId: string) {
    const actor = await this.membership(actorId, groupId);
    const target = await this.membership(targetId, groupId);
    if (!actor || !target) return "missing" as const;
    if (
      !privileged(actor.role) ||
      target.role === "owner" ||
      (actor.role === "admin" && target.role === "admin")
    )
      return "forbidden" as const;
    await this.db.query(
      "UPDATE group_members SET status='removed',left_at=UTC_TIMESTAMP(6),updated_at=UTC_TIMESTAMP(6) WHERE group_id=? AND user_id=?",
      { replacements: [groupId, targetId], type: QueryTypes.UPDATE },
    );
    await this.notify(
      targetId,
      "removed",
      "Acesso ao grupo removido",
      "Você não faz mais parte deste grupo.",
      groupId,
      null,
    );
    return "ok" as const;
  }
  async leave(userId: string, groupId: string) {
    const m = await this.membership(userId, groupId);
    if (!m) return "missing" as const;
    if (m.role === "owner") return "owner" as const;
    await this.db.query(
      "UPDATE group_members SET status='left',left_at=UTC_TIMESTAMP(6),updated_at=UTC_TIMESTAMP(6) WHERE group_id=? AND user_id=?",
      { replacements: [groupId, userId], type: QueryTypes.UPDATE },
    );
    return "ok" as const;
  }

  async listPosts(userId: string, groupId: string, before?: string) {
    await this.purgeExpiredPhotos();
    const m = await this.membership(userId, groupId);
    if (!m) return null;
    const params: any[] = [userId, userId, groupId];
    let cursor = "";
    if (before) {
      const [date,id]=before.split('|');
      if(id){cursor=" AND (p.created_at < ? OR (p.created_at = ? AND p.id < ?))";params.push(date,date,id);}
      else{cursor = " AND p.created_at < ?";params.push(new Date(before));}
    }
    const rows = await this.db.query<any>(
      `SELECT DATE_FORMAT(p.created_at,'%Y-%m-%d %H:%i:%s.%f') cursorTime,p.id,p.group_id groupId,p.author_user_id,p.kind,p.event_type eventType,p.text,(p.photo_data IS NOT NULL OR p.photo_path IS NOT NULL) hasPhoto,p.comments_enabled commentsEnabled,p.created_at createdAt,p.updated_at updatedAt,u.id authorId,u.username,COALESCE(u.display_name,CONCAT(u.first_name,' ',u.last_name)) displayName,u.avatar_url avatarUrl,(SELECT COUNT(*) FROM group_comments c WHERE c.post_id=p.id AND c.deleted_at IS NULL) commentCount FROM group_posts p JOIN users u ON u.id=p.author_user_id JOIN group_members viewer ON viewer.group_id=p.group_id AND viewer.user_id=? AND viewer.status='active' WHERE NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_user_id=? AND b.blocked_user_id=p.author_user_id) AND p.group_id=? AND p.deleted_at IS NULL AND p.created_at>=viewer.joined_at${cursor} ORDER BY p.created_at DESC,p.id DESC LIMIT 31`,
      { replacements: params, type: QueryTypes.SELECT },
    );
    const visible = rows.slice(0, 30);
    const ids = visible.map((r: any) => r.id);
    const reactions = ids.length
      ? await this.db.query<any>(
          "SELECT post_id postId,reaction,COUNT(*) count,MAX(user_id=?) reactedByMe FROM group_post_reactions WHERE post_id IN (?) GROUP BY post_id,reaction",
          { replacements: [userId, ids], type: QueryTypes.SELECT },
        )
      : [];
    const items: GroupPost[] = visible.map((r: any) => ({
      id: r.id,
      groupId: r.groupId,
      author: {
        id: r.authorId,
        username: r.username,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
      },
      kind: r.kind,
      eventType: r.eventType,
      text: r.text,
      photoUrl: r.hasPhoto ? `/groups/${groupId}/posts/${r.id}/photo` : null,
      commentsEnabled: Boolean(r.commentsEnabled),
      reactionCounts: reactions
        .filter((x: any) => x.postId === r.id)
        .map((x: any) => ({
          reaction: x.reaction,
          count: Number(x.count),
          reactedByMe: Boolean(x.reactedByMe),
        })),
      commentCount: Number(r.commentCount),
      createdAt: iso(r.createdAt),
      updatedAt: iso(r.updatedAt),
      edited: +new Date(r.updatedAt) !== +new Date(r.createdAt),
    }));
    return {
      items,
      nextCursor: rows.length > 30 ? `${visible.at(-1).cursorTime}|${visible.at(-1).id}` : null,
    };
  }
  async createPost(
    userId: string,
    groupId: string,
    input: CreateGroupPostInput,
    transaction?:Transaction,
    storedPhoto?:{mime:string;path:string},
  ) {
    const m = await this.membership(userId, groupId);
    if (!m) return "missing" as const;
    const [g] = await this.db.query<{
      active: number;
      posting_mode: string;
      comments_enabled: number;
    }>("SELECT active,posting_mode,comments_enabled FROM `groups` WHERE id=?", {
      replacements: [groupId],
      type: QueryTypes.SELECT,
    });
    if (!g?.active) return "missing" as const;
    if (g.posting_mode === "admins_only" && !privileged(m.role))
      return "forbidden" as const;
    let mime: string | null = null;
    let data: Buffer | null = null;
    if (input.photoDataUrl&&!storedPhoto) {
      const parsed = await this.photo(input.photoDataUrl);
      if (!parsed) return "invalid_photo" as const;
      ({ mime, data } = parsed);
    }
    const id = randomUUID();
    const photoPath=storedPhoto?.path??(data?await saveMedia(data):null);
    if(storedPhoto)mime=storedPhoto.mime;
    try {
    await this.db.query(
      "INSERT INTO group_posts (id,group_id,author_user_id,kind,text,photo_mime,photo_path,comments_enabled,created_at,updated_at) VALUES (?,?,?,'manual',?,?,?,?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))",
      {
        replacements: [
          id,
          groupId,
          userId,
          input.text ?? null,
          mime,
          photoPath,
          (input.commentsEnabled ?? true) && Boolean(g.comments_enabled),
        ],
        type: QueryTypes.INSERT,
        transaction,
      },
    );
    }catch(error){if(photoPath&&!storedPhoto)await removeMedia(photoPath);throw error;}
    return id;
  }
  private async photo(value: string) {
    try {
      const match = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(value);
      if (!match) return null;
      const original = Buffer.from(match[2], "base64");
      if (original.length > 10 * 1024 * 1024) return null;
      const metadata = await sharp(original, {
        limitInputPixels: 40_000_000,
      }).metadata();
      if (!["jpeg", "png", "webp"].includes(metadata.format ?? "")) return null;
      const data = await sharp(original, { limitInputPixels: 40_000_000 })
        .rotate()
        .resize({
          width: 1920,
          height: 1920,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer();
      return { mime: "image/webp", data };
    } catch {
      return null;
    }
  }
  async photoData(userId: string, groupId: string, postId: string) {
    await this.purgeExpiredPhotos();
    const m = await this.membership(userId, groupId);
    if (!m) return null;
    const [row] = await this.db.query<{
      photo_mime: string;
      photo_data: Buffer;
      photo_path:string|null;
    }>(
      "SELECT p.photo_mime,p.photo_data,p.photo_path FROM group_posts p JOIN group_members viewer ON viewer.group_id=p.group_id AND viewer.user_id=? AND viewer.status='active' WHERE p.id=? AND p.group_id=? AND p.deleted_at IS NULL AND p.created_at>=viewer.joined_at AND (p.photo_data IS NOT NULL OR p.photo_path IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_user_id=? AND b.blocked_user_id=p.author_user_id)",
      {
        replacements: [userId, postId, groupId, userId],
        type: QueryTypes.SELECT,
      },
    );
    return row ? { mime: row.photo_mime, data: row.photo_path?await readMedia(row.photo_path):row.photo_data } : null;
  }
  async updatePost(
    userId: string,
    groupId: string,
    postId: string,
    input: UpdateGroupPostInput,
  ) {
    const m = await this.membership(userId, groupId);
    if (!m) return "missing" as const;
    const [post] = await this.db.query<{
      author_user_id: string;
      kind: string;
    }>(
      "SELECT p.author_user_id,p.kind FROM group_posts p JOIN group_members viewer ON viewer.group_id=p.group_id AND viewer.user_id=? AND viewer.status='active' WHERE p.id=? AND p.group_id=? AND p.deleted_at IS NULL AND p.created_at>=viewer.joined_at",
      { replacements: [userId, postId, groupId], type: QueryTypes.SELECT },
    );
    if (!post) return "missing" as const;
    if (post.author_user_id !== userId || post.kind === "event")
      return "forbidden" as const;
    await this.db.query(
      "UPDATE group_posts SET text=?,comments_enabled=COALESCE(?,comments_enabled),updated_at=UTC_TIMESTAMP(6) WHERE id=?",
      {
        replacements: [input.text, input.commentsEnabled ?? null, postId],
        type: QueryTypes.UPDATE,
      },
    );
    return "ok" as const;
  }
  async deletePost(userId: string, groupId: string, postId: string) {
    const m = await this.membership(userId, groupId);
    if (!m) return "missing" as const;
    const [post] = await this.db.query<{ author_user_id: string }>(
      "SELECT p.author_user_id FROM group_posts p JOIN group_members viewer ON viewer.group_id=p.group_id AND viewer.user_id=? AND viewer.status='active' WHERE p.id=? AND p.group_id=? AND p.deleted_at IS NULL AND p.created_at>=viewer.joined_at",
      { replacements: [userId, postId, groupId], type: QueryTypes.SELECT },
    );
    if (!post) return "missing" as const;
    if (post.author_user_id !== userId && !moderator(m.role))
      return "forbidden" as const;
    await this.db.query(
      "UPDATE group_posts SET deleted_at=UTC_TIMESTAMP(6),removed_by_user_id=?,updated_at=UTC_TIMESTAMP(6) WHERE id=?",
      { replacements: [userId, postId], type: QueryTypes.UPDATE },
    );
    return "ok" as const;
  }
  async react(
    userId: string,
    groupId: string,
    postId: string,
    reaction: GroupReaction | null,
  ) {
    const m = await this.membership(userId, groupId);
    if (!m) return "missing" as const;
    const [post] = await this.db.query<{ id: string; author_user_id: string }>(
      "SELECT p.id,p.author_user_id FROM group_posts p JOIN group_members viewer ON viewer.group_id=p.group_id AND viewer.user_id=? AND viewer.status='active' WHERE p.id=? AND p.group_id=? AND p.deleted_at IS NULL AND p.created_at>=viewer.joined_at",
      { replacements: [userId, postId, groupId], type: QueryTypes.SELECT },
    );
    if (!post) return "missing" as const;
    if (!reaction)
      await this.db.query(
        "DELETE FROM group_post_reactions WHERE post_id=? AND user_id=?",
        { replacements: [postId, userId], type: QueryTypes.DELETE },
      );
    else
      await this.db.query(
        "INSERT INTO group_post_reactions (id,post_id,user_id,reaction,created_at,updated_at) VALUES (?,?,?,?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE reaction=VALUES(reaction),updated_at=UTC_TIMESTAMP(6)",
        {
          replacements: [randomUUID(), postId, userId, reaction],
          type: QueryTypes.INSERT,
        },
      );
    return "ok" as const;
  }
  async comments(
    userId: string,
    groupId: string,
    postId: string,
  ): Promise<GroupComment[] | null> {
    const m = await this.membership(userId, groupId);
    if (!m) return null;
    const [post] = await this.db.query<{ id: string }>(
      "SELECT p.id FROM group_posts p JOIN group_members viewer ON viewer.group_id=p.group_id AND viewer.user_id=? AND viewer.status='active' WHERE p.id=? AND p.group_id=? AND p.created_at>=viewer.joined_at AND p.deleted_at IS NULL",
      { replacements: [userId, postId, groupId], type: QueryTypes.SELECT },
    );
    if (!post) return null;
    const rows = await this.db.query<any>(
      "SELECT c.id,c.post_id postId,c.text,c.deleted_at deletedAt,c.created_at createdAt,c.updated_at updatedAt,u.id authorId,u.username,COALESCE(u.display_name,CONCAT(u.first_name,' ',u.last_name)) displayName,u.avatar_url avatarUrl FROM group_comments c JOIN users u ON u.id=c.author_user_id WHERE c.post_id=? ORDER BY c.created_at",
      { replacements: [postId], type: QueryTypes.SELECT },
    );
    return rows.map((r: any) => ({
      id: r.id,
      postId: r.postId,
      author: {
        id: r.authorId,
        username: r.username,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
      },
      text: r.deletedAt ? "Comentário removido" : r.text,
      removed: Boolean(r.deletedAt),
      createdAt: iso(r.createdAt),
      updatedAt: iso(r.updatedAt),
      edited: +new Date(r.updatedAt) !== +new Date(r.createdAt),
    }));
  }
  async addComment(
    userId: string,
    groupId: string,
    postId: string,
    input: CreateGroupCommentInput,
  ) {
    const m = await this.membership(userId, groupId);
    if (!m) return "missing" as const;
    const [post] = await this.db.query<{
      author_user_id: string;
      comments_enabled: number;
    }>(
      "SELECT p.author_user_id,p.comments_enabled FROM group_posts p JOIN group_members viewer ON viewer.group_id=p.group_id AND viewer.user_id=? AND viewer.status='active' WHERE p.id=? AND p.group_id=? AND p.deleted_at IS NULL AND p.created_at>=viewer.joined_at",
      { replacements: [userId, postId, groupId], type: QueryTypes.SELECT },
    );
    if (!post) return "missing" as const;
    if (!post.comments_enabled) return "disabled" as const;
    const id = randomUUID();
    await this.db.transaction(async (t) => {
      await this.db.query(
        "INSERT INTO group_comments (id,post_id,author_user_id,text,created_at,updated_at) VALUES (?,?,?,?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))",
        {
          replacements: [id, postId, userId, input.text],
          type: QueryTypes.INSERT,
          transaction: t,
        },
      );
      if (post.author_user_id !== userId) {
        const author = await this.user(userId, t);
        await this.notify(
          post.author_user_id,
          "comment",
          "Novo comentário",
          `${author.displayName} comentou na sua publicação.`,
          groupId,
          postId,
          t,
        );
      }
    });
    return id;
  }
  async updateComment(
    userId: string,
    groupId: string,
    commentId: string,
    text: string,
  ) {
    const m = await this.membership(userId, groupId);
    if (!m) return "missing" as const;
    const [comment] = await this.db.query<{ author_user_id: string }>(
      "SELECT c.author_user_id FROM group_comments c JOIN group_posts p ON p.id=c.post_id JOIN group_members viewer ON viewer.group_id=p.group_id AND viewer.user_id=? AND viewer.status='active' WHERE c.id=? AND p.group_id=? AND c.deleted_at IS NULL AND p.created_at>=viewer.joined_at",
      {
        replacements: [userId, commentId, groupId],
        type: QueryTypes.SELECT,
      },
    );
    if (!comment) return "missing" as const;
    if (comment.author_user_id !== userId) return "forbidden" as const;
    await this.db.query(
      "UPDATE group_comments SET text=?,updated_at=UTC_TIMESTAMP(6) WHERE id=?",
      { replacements: [text, commentId], type: QueryTypes.UPDATE },
    );
    return "ok" as const;
  }
  async deleteComment(userId: string, groupId: string, commentId: string) {
    const m = await this.membership(userId, groupId);
    if (!m) return "missing" as const;
    const [comment] = await this.db.query<{ author_user_id: string }>(
      "SELECT c.author_user_id FROM group_comments c JOIN group_posts p ON p.id=c.post_id JOIN group_members viewer ON viewer.group_id=p.group_id AND viewer.user_id=? AND viewer.status='active' WHERE c.id=? AND p.group_id=? AND c.deleted_at IS NULL AND p.created_at>=viewer.joined_at",
      {
        replacements: [userId, commentId, groupId],
        type: QueryTypes.SELECT,
      },
    );
    if (!comment) return "missing" as const;
    if (comment.author_user_id !== userId && !moderator(m.role))
      return "forbidden" as const;
    await this.db.query(
      "UPDATE group_comments SET deleted_at=UTC_TIMESTAMP(6),removed_by_user_id=?,updated_at=UTC_TIMESTAMP(6) WHERE id=?",
      { replacements: [userId, commentId], type: QueryTypes.UPDATE },
    );
    return "ok" as const;
  }

  async markSeen(userId: string, groupId: string) {
    if (!(await this.membership(userId, groupId))) return false;
    await this.db.query(
      "UPDATE group_members SET last_seen_at=UTC_TIMESTAMP(6),updated_at=UTC_TIMESTAMP(6) WHERE group_id=? AND user_id=? AND status='active'",
      { replacements: [groupId, userId], type: QueryTypes.UPDATE },
    );
    return true;
  }
  async dashboard(userId: string): Promise<GroupDashboard> {
    const [
      [unseenPosts],
      [unseenComments],
      [unseenReactions],
      [invites],
      [notifications],
    ] = await Promise.all([
      this.db.query<any>(
        "SELECT COUNT(*) total FROM group_posts p JOIN group_members m ON m.group_id=p.group_id AND m.user_id=? AND m.status='active' WHERE p.deleted_at IS NULL AND p.created_at>=m.joined_at AND p.created_at>COALESCE(m.last_seen_at,m.joined_at)",
        { replacements: [userId], type: QueryTypes.SELECT },
      ),
      this.db.query<any>(
        "SELECT COUNT(*) total FROM group_comments c JOIN group_posts p ON p.id=c.post_id JOIN group_members m ON m.group_id=p.group_id AND m.user_id=? AND m.status='active' WHERE c.deleted_at IS NULL AND p.created_at>=m.joined_at AND c.created_at>COALESCE(m.last_seen_at,m.joined_at)",
        { replacements: [userId], type: QueryTypes.SELECT },
      ),
      this.db.query<any>(
        "SELECT COUNT(*) total FROM group_post_reactions r JOIN group_posts p ON p.id=r.post_id JOIN group_members m ON m.group_id=p.group_id AND m.user_id=? AND m.status='active' WHERE p.created_at>=m.joined_at AND r.created_at>COALESCE(m.last_seen_at,m.joined_at)",
        { replacements: [userId], type: QueryTypes.SELECT },
      ),
      this.db.query<any>(
        "SELECT COUNT(*) total FROM group_invites WHERE invited_user_id=? AND status='pending' AND expires_at>UTC_TIMESTAMP(6)",
        { replacements: [userId], type: QueryTypes.SELECT },
      ),
      this.db.query<any>(
        "SELECT COUNT(*) total FROM group_notifications WHERE user_id=? AND read_at IS NULL",
        { replacements: [userId], type: QueryTypes.SELECT },
      ),
    ]);
    return {
      totalUnseen:
        Number(unseenPosts?.total ?? 0) +
        Number(unseenComments?.total ?? 0) +
        Number(unseenReactions?.total ?? 0),
      pendingInvites: Number(invites?.total ?? 0),
      notificationsUnread: Number(notifications?.total ?? 0),
    };
  }
  async notifications(userId: string): Promise<GroupNotification[]> {
    const rows = await this.db.query<any>(
      "SELECT id,type,title,message,group_id groupId,post_id postId,read_at readAt,created_at createdAt FROM group_notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100",
      { replacements: [userId], type: QueryTypes.SELECT },
    );
    return rows.map((r: any) => ({
      ...r,
      readAt: r.readAt ? iso(r.readAt) : null,
      createdAt: iso(r.createdAt),
    }));
  }
  async readNotification(userId: string, id: string) {
    const [item] = await this.db.query<{ id: string }>(
      "SELECT id FROM group_notifications WHERE id=? AND user_id=?",
      { replacements: [id, userId], type: QueryTypes.SELECT },
    );
    if (!item) return false;
    await this.db.query(
      "UPDATE group_notifications SET read_at=COALESCE(read_at,UTC_TIMESTAMP(6)) WHERE id=? AND user_id=?",
      { replacements: [id, userId], type: QueryTypes.UPDATE },
    );
    return true;
  }
  async report(
    userId: string,
    groupId: string,
    targetType: "post" | "comment",
    targetId: string,
    reason: GroupReportReason,
    details?: string | null,
  ) {
    const membership = await this.membership(userId, groupId);
    if (!membership) return "missing" as const;
    const [target] =
      targetType === "post"
        ? await this.db.query<{ id: string }>(
            "SELECT p.id FROM group_posts p JOIN group_members viewer ON viewer.group_id=p.group_id AND viewer.user_id=? AND viewer.status='active' WHERE p.id=? AND p.group_id=? AND p.created_at>=viewer.joined_at AND p.deleted_at IS NULL",
            {
              replacements: [userId, targetId, groupId],
              type: QueryTypes.SELECT,
            },
          )
        : await this.db.query<{ id: string }>(
            "SELECT c.id FROM group_comments c JOIN group_posts p ON p.id=c.post_id JOIN group_members viewer ON viewer.group_id=p.group_id AND viewer.user_id=? AND viewer.status='active' WHERE c.id=? AND p.group_id=? AND p.created_at>=viewer.joined_at AND c.created_at>=viewer.joined_at AND p.deleted_at IS NULL AND c.deleted_at IS NULL",
            {
              replacements: [userId, targetId, groupId],
              type: QueryTypes.SELECT,
            },
          );
    if (!target) return "missing" as const;
    try {
      await this.db.query(
        "INSERT INTO group_reports (id,group_id,reporter_user_id,target_type,target_id,reason,details,status,created_at) VALUES (?,?,?,?,?,?,?,'pending',UTC_TIMESTAMP(6))",
        {
          replacements: [
            randomUUID(),
            groupId,
            userId,
            targetType,
            targetId,
            reason,
            details ?? null,
          ],
          type: QueryTypes.INSERT,
        },
      );
    } catch {
      return "conflict" as const;
    }
    return "ok" as const;
  }
  async reports(
    userId: string,
    groupId: string,
  ): Promise<GroupReport[] | "forbidden" | "missing"> {
    const m = await this.membership(userId, groupId);
    if (!m) return "missing";
    if (!moderator(m.role)) return "forbidden";
    const rows = await this.db.query<any>(
      "SELECT r.id,r.target_type targetType,r.target_id targetId,r.reason,r.details,r.status,r.created_at createdAt,r.resolved_at resolvedAt,u.id reporterId,u.username,COALESCE(u.display_name,CONCAT(u.first_name,' ',u.last_name)) displayName,u.avatar_url avatarUrl FROM group_reports r JOIN users u ON u.id=r.reporter_user_id WHERE r.group_id=? ORDER BY r.status='pending' DESC,r.created_at DESC",
      { replacements: [groupId], type: QueryTypes.SELECT },
    );
    return rows.map((r: any) => ({
      id: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      details: r.details,
      status: r.status,
      reporter: {
        id: r.reporterId,
        username: r.username,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
      },
      createdAt: iso(r.createdAt),
      resolvedAt: r.resolvedAt ? iso(r.resolvedAt) : null,
    }));
  }
  async resolveReport(
    userId: string,
    groupId: string,
    reportId: string,
    resolution: "dismissed" | "content_removed",
    note?: string | null,
  ) {
    const m = await this.membership(userId, groupId);
    if (!m) return "missing" as const;
    if (!moderator(m.role)) return "forbidden" as const;
    return this.db.transaction(async (t) => {
      const [report] = await this.db.query<any>(
        "SELECT * FROM group_reports WHERE id=? AND group_id=? AND status='pending' FOR UPDATE",
        {
          replacements: [reportId, groupId],
          type: QueryTypes.SELECT,
          transaction: t,
        },
      );
      if (!report) return "missing" as const;
      if (resolution === "content_removed") {
        const table =
          report.target_type === "post" ? "group_posts" : "group_comments";
        await this.db.query(
          `UPDATE ${table} SET deleted_at=UTC_TIMESTAMP(6),removed_by_user_id=?,updated_at=UTC_TIMESTAMP(6) WHERE id=?`,
          {
            replacements: [userId, report.target_id],
            type: QueryTypes.UPDATE,
            transaction: t,
          },
        );
      }
      await this.db.query(
        "UPDATE group_reports SET status=?,resolved_by_user_id=?,resolution_note=?,resolved_at=UTC_TIMESTAMP(6) WHERE id=?",
        {
          replacements: [resolution, userId, note ?? null, reportId],
          type: QueryTypes.UPDATE,
          transaction: t,
        },
      );
      await this.notify(
        report.reporter_user_id,
        "report_resolved",
        "Denúncia analisada",
        resolution === "content_removed"
          ? "O conteúdo denunciado foi removido."
          : "A denúncia foi analisada e encerrada.",
        groupId,
        null,
        t,
      );
      return "ok" as const;
    });
  }
  /** People this user hid from their feeds, so the choice can be reviewed and undone. */
  async listBlocked(userId: string): Promise<GroupUser[]> {
    return this.db.query<GroupUser>(
      "SELECT u.id,u.username,COALESCE(u.display_name,CONCAT(u.first_name,' ',u.last_name)) displayName,u.avatar_url avatarUrl FROM user_blocks b JOIN users u ON u.id=b.blocked_user_id WHERE b.blocker_user_id=? ORDER BY b.created_at DESC LIMIT 200",
      { replacements: [userId], type: QueryTypes.SELECT },
    );
  }
  async setBlock(userId: string, targetId: string, blocked: boolean) {
    if (userId === targetId) return false;
    if (blocked)
      await this.db.query(
        "INSERT IGNORE INTO user_blocks (blocker_user_id,blocked_user_id,created_at) VALUES (?,?,UTC_TIMESTAMP(6))",
        { replacements: [userId, targetId], type: QueryTypes.INSERT },
      );
    else
      await this.db.query(
        "DELETE FROM user_blocks WHERE blocker_user_id=? AND blocked_user_id=?",
        { replacements: [userId, targetId], type: QueryTypes.DELETE },
      );
    return true;
  }

  async createActivityPosts(
    userId: string,
    eventType: Exclude<GroupEventType, "member_joined">,
    sourceType: string,
    sourceId: string,
  ) {
    const textMap: Record<string, string> = {
      workout_completed: "concluiu um treino hoje!",
      cardio_completed: "concluiu um cardio hoje!",
      weekly_goal: "atingiu sua meta semanal!",
      weekly_streak: "manteve sua sequência semanal!",
    };
    const rows = await this.db.query<any>(
      `SELECT m.group_id groupId FROM group_members m JOIN \`groups\` g ON g.id=m.group_id JOIN group_event_settings s ON s.group_id=g.id JOIN group_share_preferences p ON p.group_id=g.id AND p.user_id=m.user_id WHERE m.user_id=? AND m.status='active' AND g.active=1 AND s.${eventType}=1 AND p.${eventType}=1`,
      { replacements: [userId], type: QueryTypes.SELECT },
    );
    const user = await this.user(userId);
    for (const row of rows) {
      await this.db.query(
        `INSERT IGNORE INTO group_posts (id,group_id,author_user_id,kind,event_type,text,comments_enabled,source_type,source_id,created_at,updated_at) SELECT ?,?,?, 'event',?,?,comments_enabled,?,?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6) FROM \`groups\` WHERE id=?`,
        {
          replacements: [
            randomUUID(),
            row.groupId,
            userId,
            eventType,
            `${user.displayName} ${textMap[eventType]}`,
            sourceType,
            sourceId,
            row.groupId,
          ],
          type: QueryTypes.INSERT,
        },
      );
    }
  }
  async shareActivity(
    userId: string,
    groupIds: string[],
    eventType: Exclude<GroupEventType, "member_joined">,
    sourceType: string,
    sourceId: string,
  ) {
    // Lock the source and all selected memberships until publication commits.
    const sourceTable = sourceType === 'workout_session' ? 'workout_sessions' : sourceType === 'cardio_session' ? 'cardio_sessions' : null;
    if (!sourceTable || (sourceType === 'cardio_session' ? eventType !== 'cardio_completed' : eventType !== 'workout_completed')) return 'missing' as const;
    return this.db.transaction(async transaction => {
      const [source] = await this.db.query<{ id: string }>(
        `SELECT id FROM ${sourceTable} WHERE id=? AND user_id=?${sourceType === 'workout_session' ? " AND status='completed'" : ''} FOR UPDATE`,
        { replacements: [sourceId, userId], type: QueryTypes.SELECT, transaction },
      );
      if (!source) return 'missing' as const;
      const ids = [...new Set(groupIds)].sort();
      const allowedGroups: { id: string; comments: boolean }[] = [];
      for (const groupId of ids) {
        const [allowed] = await this.db.query<{ comments: boolean }>(
          `SELECT g.comments_enabled comments FROM group_members m JOIN \`groups\` g ON g.id=m.group_id JOIN group_event_settings s ON s.group_id=g.id WHERE m.user_id=? AND m.group_id=? AND m.status='active' AND g.active=1 AND s.${eventType}=1 FOR UPDATE`,
          { replacements: [userId, groupId], type: QueryTypes.SELECT, transaction },
        );
        if (!allowed) return 'forbidden' as const;
        allowedGroups.push({ id: groupId, comments: Boolean(allowed.comments) });
      }
      const user = await this.user(userId, transaction);
      let created = 0;
      for (const group of allowedGroups) {
        const [, count] = await this.db.query(
          "INSERT IGNORE INTO group_posts (id,group_id,author_user_id,kind,event_type,text,comments_enabled,source_type,source_id,created_at,updated_at) VALUES (?,?,?,'event',?,?,?,?,?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))",
          { replacements: [randomUUID(), group.id, userId, eventType, `${user.displayName} concluiu um ${sourceType === 'workout_session' ? 'treino' : 'cardio'} hoje!`, group.comments, sourceType, sourceId], type: QueryTypes.INSERT, transaction },
        );
        if (Number(count) > 0) created++;
      }
      return created;
    });
  }

  async detachActivity(userId: string, sourceType: string, sourceId: string) {
    await this.db.query(
      "UPDATE group_posts SET text=text WHERE author_user_id=? AND source_type=? AND source_id=?",
      { replacements: [userId, sourceType, sourceId], type: QueryTypes.UPDATE },
    );
  }
}
