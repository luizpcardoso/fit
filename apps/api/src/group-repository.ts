import { createHash, randomBytes, randomUUID } from "node:crypto";
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
  GroupActivityStats,
  GroupInviteLink,
  GroupJoinPreview,
  GroupJoinRequest,
  GroupNotification,
  GroupParticipation,
  GroupWeekSummary,
  GroupPostReaction,
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
const groupMediaUrl = (groupId:string, kind:'avatar'|'cover', updatedAt:Date|string) =>
  `/groups/${groupId}/media/${kind}?v=${new Date(updatedAt).getTime()}`;

export class GroupRepository {
  constructor(private readonly db: Sequelize) {}
  async purgeExpiredPhotos(){
    const expired=await this.db.query<{id:string;photo_path:string|null}>("SELECT id,photo_path FROM group_posts WHERE (photo_data IS NOT NULL OR photo_path IS NOT NULL) AND (deleted_at IS NOT NULL OR created_at<=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 48 HOUR))",{type:QueryTypes.SELECT});
    for(const post of expired){await this.db.query('DELETE FROM group_posts WHERE id=?',{replacements:[post.id],type:QueryTypes.DELETE});if(post.photo_path){const [remaining]=await this.db.query<{id:string}>('SELECT id FROM group_posts WHERE photo_path=? LIMIT 1',{replacements:[post.photo_path],type:QueryTypes.SELECT});if(!remaining)await removeMedia(post.photo_path);}}
  }
  // Group images and post photos share the media folder with public avatars/exercise images; public routes must refuse them.
  async isPrivateMedia(key:string){const rows=await this.db.query('SELECT 1 FROM `groups` WHERE avatar_path=? OR cover_path=? UNION ALL SELECT 1 FROM group_posts WHERE photo_path=? LIMIT 1',{replacements:[key,key,key],type:QueryTypes.SELECT});return rows.length>0;}
  async migratePhotos(){const rows=await this.db.query<{id:string;photo_data:Buffer}>('SELECT id,photo_data FROM group_posts WHERE photo_data IS NOT NULL LIMIT 20',{type:QueryTypes.SELECT});for(const row of rows){const key=await saveMedia(row.photo_data);try{await this.db.query('UPDATE group_posts SET photo_path=?,photo_data=NULL WHERE id=?',{replacements:[key,row.id],type:QueryTypes.UPDATE});}catch(error){await removeMedia(key);throw error;}}return rows.length;}
  async publishToGroups(userId:string,groupIds:string[],input:CreateGroupPostInput){
    const processed=input.photoDataUrl?await this.photo(input.photoDataUrl):null;
    if(input.photoDataUrl&&!processed)return 'invalid_photo';
    const ids=[...new Set(groupIds)];
    for(const id of ids){const group=await this.get(userId,id);if(!group)return 'missing';if(!group.active||group.postingMode==='admins_only'&&!privileged(group.role))return 'forbidden';}
    const sharedPhoto=processed?{mime:processed.mime,path:await saveMedia(processed.data),width:processed.width,height:processed.height}:null;
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
      `SELECT g.id,g.name,g.description,g.avatar_url avatarUrl,g.avatar_path avatarPath,g.cover_path coverPath,g.updated_at updatedAt,m.role,g.active,g.created_at createdAt,(SELECT COUNT(*) FROM group_members x WHERE x.group_id=g.id AND x.status='active') memberCount,((SELECT COUNT(*) FROM group_posts p WHERE p.group_id=g.id AND p.author_user_id<>m.user_id AND p.deleted_at IS NULL AND p.created_at>=m.joined_at AND p.created_at>COALESCE(m.last_seen_at,m.joined_at))+(SELECT COUNT(*) FROM group_comments c JOIN group_posts p ON p.id=c.post_id WHERE p.group_id=g.id AND c.author_user_id<>m.user_id AND p.created_at>=m.joined_at AND c.deleted_at IS NULL AND c.created_at>COALESCE(m.last_seen_at,m.joined_at))+(SELECT COUNT(*) FROM group_post_reactions r JOIN group_posts p ON p.id=r.post_id WHERE p.group_id=g.id AND r.user_id<>m.user_id AND p.created_at>=m.joined_at AND r.created_at>COALESCE(m.last_seen_at,m.joined_at))) unseenCount FROM group_members m JOIN \`groups\` g ON g.id=m.group_id WHERE m.user_id=? AND m.status='active' ORDER BY g.active DESC,g.updated_at DESC`,
      { replacements: [userId], type: QueryTypes.SELECT },
    );
    // Storage keys stay internal: the files are served only through the member-checked media route.
    return rows.map(({ avatarPath, coverPath, ...r }: any) => ({
      ...r,
      avatarUrl: avatarPath ? groupMediaUrl(r.id,'avatar',r.updatedAt) : r.avatarUrl,
      coverUrl: coverPath ? groupMediaUrl(r.id,'cover',r.updatedAt) : null,
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
      `SELECT g.id,g.name,g.description,g.avatar_url avatarUrl,g.avatar_path avatarPath,g.cover_path coverPath,g.updated_at updatedAt,g.posting_mode postingMode,g.comments_enabled commentsEnabled,g.allow_activity_stats allowActivityStats,g.active,g.created_at createdAt,(SELECT COUNT(*) FROM group_members x WHERE x.group_id=g.id AND x.status='active') memberCount,(SELECT COUNT(*) FROM group_posts p WHERE p.group_id=g.id AND p.deleted_at IS NULL AND p.created_at>=(SELECT joined_at FROM group_members WHERE group_id=g.id AND user_id=? AND status='active') AND p.created_at>COALESCE((SELECT last_seen_at FROM group_members WHERE group_id=g.id AND user_id=?),(SELECT joined_at FROM group_members WHERE group_id=g.id AND user_id=? AND status='active'))) unseenCount FROM \`groups\` g WHERE g.id=?`,
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
    const [participation] = await this.db.query<any>(
      "SELECT show_in_ranking showInRanking,share_activity_stats shareActivityStats FROM group_share_preferences WHERE group_id=? AND user_id=?",
      { replacements: [groupId, userId], type: QueryTypes.SELECT },
    );
    const { avatarPath, coverPath, ...group } = g;
    return {
      ...group,
      avatarUrl: avatarPath ? groupMediaUrl(g.id,'avatar',g.updatedAt) : g.avatarUrl,
      coverUrl: coverPath ? groupMediaUrl(g.id,'cover',g.updatedAt) : null,
      role: m.role,
      active: Boolean(g.active),
      commentsEnabled: Boolean(g.commentsEnabled),
      allowActivityStats: Boolean(g.allowActivityStats),
      participation: { showInRanking: Boolean(participation?.showInRanking), shareActivityStats: Boolean(participation?.shareActivityStats) },
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
      allowActivityStats: "allow_activity_stats",
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
  async updateMedia(userId:string,groupId:string,kind:'avatar'|'cover',photoDataUrl:string|null) {
    const membership=await this.membership(userId,groupId);
    if(!membership)return 'missing' as const;
    if(!privileged(membership.role))return 'forbidden' as const;
    const [current]=await this.db.query<{avatar_path:string|null;cover_path:string|null}>('SELECT avatar_path,cover_path FROM `groups` WHERE id=?',{replacements:[groupId],type:QueryTypes.SELECT});
    if(!current)return 'missing' as const;
    const processed=photoDataUrl?await this.groupImage(photoDataUrl,kind):null;
    if(photoDataUrl&&!processed)return 'invalid_photo' as const;
    const nextPath=processed?await saveMedia(processed):null;
    const column=kind==='avatar'?'avatar_path':'cover_path';
    const previous=kind==='avatar'?current.avatar_path:current.cover_path;
    try{
      await this.db.query(`UPDATE \`groups\` SET ${column}=?,${kind==='avatar'?'avatar_url=NULL,':''}updated_at=UTC_TIMESTAMP(6) WHERE id=?`,{replacements:[nextPath,groupId],type:QueryTypes.UPDATE});
    }catch(error){if(nextPath)await removeMedia(nextPath);throw error;}
    if(previous&&previous!==nextPath)await removeMedia(previous).catch(()=>{});
    return 'ok' as const;
  }
  async mediaData(userId:string,groupId:string,kind:'avatar'|'cover') {
    if(!await this.membership(userId,groupId))return null;
    const column=kind==='avatar'?'avatar_path':'cover_path';
    const [row]=await this.db.query<{path:string|null}>(`SELECT ${column} path FROM \`groups\` WHERE id=?`,{replacements:[groupId],type:QueryTypes.SELECT});
    if(!row?.path)return null;
    try{return await readMedia(row.path);}catch{return null;}
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

  /** Stores only the opt-ins that were sent; the automatic-share switches of the same row are left as they are. */
  async updateParticipation(userId: string, groupId: string, input: GroupParticipation) {
    const m = await this.membership(userId, groupId);
    if (!m) return "missing" as const;
    const ranking = input.showInRanking, stats = input.shareActivityStats;
    await this.db.query(
      `INSERT INTO group_share_preferences (group_id,user_id,show_in_ranking,share_activity_stats,updated_at) VALUES (?,?,?,?,UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE ${ranking === undefined ? "" : "show_in_ranking=VALUES(show_in_ranking),"}${stats === undefined ? "" : "share_activity_stats=VALUES(share_activity_stats),"}updated_at=UTC_TIMESTAMP(6)`,
      { replacements: [groupId, userId, ranking ?? false, stats ?? false], type: QueryTypes.INSERT },
    );
    return "ok" as const;
  }
  /**
   * Week (Monday to Sunday) that contains `date`. Shared activity comes from posts the viewer can already read;
   * the ranking counts completed workouts only for members who opted in, and never returns anything else about them.
   */
  async weekSummary(userId: string, groupId: string, date: string): Promise<GroupWeekSummary | null> {
    const m = await this.membership(userId, groupId);
    if (!m) return null;
    const day = new Date(`${date}T00:00:00Z`);
    const start = new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * 86_400_000);
    const weekStart = start.toISOString().slice(0, 10), weekEnd = new Date(start.getTime() + 6 * 86_400_000).toISOString().slice(0, 10);
    const hidden = "NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_user_id=? AND b.blocked_user_id=";
    const [shared] = await this.db.query<{ total: number; people: number }>(
      `SELECT COUNT(*) total,COUNT(DISTINCT p.author_user_id) people FROM group_posts p JOIN group_members viewer ON viewer.group_id=p.group_id AND viewer.user_id=? AND viewer.status='active' WHERE p.group_id=? AND p.kind='event' AND p.event_type IN ('workout_completed','cardio_completed') AND p.deleted_at IS NULL AND p.created_at>=viewer.joined_at AND p.created_at>=? AND p.created_at<DATE_ADD(?,INTERVAL 7 DAY) AND ${hidden}p.author_user_id)`,
      { replacements: [userId, groupId, weekStart, weekStart, userId], type: QueryTypes.SELECT },
    );
    const rows = await this.db.query<any>(
      `SELECT u.id,u.username,COALESCE(u.display_name,CONCAT(u.first_name,' ',u.last_name)) displayName,u.avatar_url avatarUrl,(SELECT COUNT(*) FROM workout_sessions s WHERE s.user_id=u.id AND s.status='completed' AND s.performed_on BETWEEN ? AND ?) workouts FROM group_members gm JOIN group_share_preferences sp ON sp.group_id=gm.group_id AND sp.user_id=gm.user_id AND sp.show_in_ranking=1 JOIN users u ON u.id=gm.user_id WHERE gm.group_id=? AND gm.status='active' AND ${hidden}gm.user_id) ORDER BY workouts DESC,displayName,u.id LIMIT 200`,
      { replacements: [weekStart, weekEnd, groupId, userId], type: QueryTypes.SELECT },
    );
    return {
      weekStart, weekEnd,
      sharedActivities: Number(shared?.total ?? 0),
      activePeople: Number(shared?.people ?? 0),
      participating: rows.some((row: any) => row.id === userId),
      ranking: rows.map((row: any) => ({ user: { id: row.id, username: row.username, displayName: row.displayName, avatarUrl: row.avatarUrl }, workouts: Number(row.workouts) })),
    };
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
      "SELECT i.id,i.status,i.created_at createdAt,i.expires_at expiresAt,g.id groupId,g.name groupName,g.avatar_url groupAvatar,g.avatar_path groupAvatarPath,g.updated_at groupUpdatedAt,u.id inviterId,u.username inviterUsername,COALESCE(u.display_name,CONCAT(u.first_name,' ',u.last_name)) inviterName,u.avatar_url inviterAvatar FROM group_invites i JOIN `groups` g ON g.id=i.group_id JOIN users u ON u.id=i.invited_by_user_id WHERE i.invited_user_id=? AND i.status='pending' AND i.expires_at>UTC_TIMESTAMP(6) ORDER BY i.created_at DESC",
      { replacements: [userId], type: QueryTypes.SELECT },
    );
    return rows.map((r: any) => ({
      id: r.id,
      status: r.status,
      group: { id: r.groupId, name: r.groupName, avatarUrl: r.groupAvatarPath ? groupMediaUrl(r.groupId,'avatar',r.groupUpdatedAt) : r.groupAvatar },
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
  /** Makes the person an active member with a fresh entry date and every sharing choice off. */
  private async activateMember(groupId: string, userId: string, t: Transaction) {
    await this.db.query(
      "INSERT INTO group_members (id,group_id,user_id,role,status,joined_at,left_at,last_seen_at,created_at,updated_at) VALUES (?,?,?,'member','active',UTC_TIMESTAMP(6),NULL,NULL,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE role='member',status='active',joined_at=UTC_TIMESTAMP(6),left_at=NULL,last_seen_at=NULL,updated_at=UTC_TIMESTAMP(6)",
      {
        replacements: [randomUUID(), groupId, userId],
        type: QueryTypes.INSERT,
        transaction: t,
      },
    );
    await this.db.query(
      "INSERT INTO group_share_preferences (group_id,user_id,workout_completed,cardio_completed,weekly_goal,weekly_streak,updated_at) VALUES (?,?,0,0,0,0,UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE workout_completed=0,cardio_completed=0,weekly_goal=0,weekly_streak=0,show_in_ranking=0,share_activity_stats=0,updated_at=UTC_TIMESTAMP(6)",
      {
        replacements: [groupId, userId],
        type: QueryTypes.INSERT,
        transaction: t,
      },
    );
  }
  private codeHash(code: string) { return createHash("sha256").update(code).digest("hex"); }
  private async usableLink(code: string, t?: Transaction) {
    const [link] = await this.db.query<{ id: string; groupId: string; name: string; memberCount: number }>(
      "SELECT l.id,l.group_id groupId,g.name,(SELECT COUNT(*) FROM group_members x WHERE x.group_id=g.id AND x.status='active') memberCount FROM group_invite_links l JOIN `groups` g ON g.id=l.group_id AND g.active=1 WHERE l.code_hash=? AND l.revoked_at IS NULL AND l.expires_at>UTC_TIMESTAMP(6)",
      { replacements: [this.codeHash(code)], type: QueryTypes.SELECT, transaction: t },
    );
    return link ?? null;
  }
  /** Whether the group has a usable code. The code itself is only returned when it is created. */
  async inviteLink(userId: string, groupId: string): Promise<GroupInviteLink | "missing" | "forbidden"> {
    const m = await this.membership(userId, groupId);
    if (!m) return "missing";
    if (!privileged(m.role)) return "forbidden";
    const [link] = await this.db.query<{ expiresAt: Date }>(
      "SELECT expires_at expiresAt FROM group_invite_links WHERE group_id=? AND revoked_at IS NULL AND expires_at>UTC_TIMESTAMP(6) ORDER BY created_at DESC LIMIT 1",
      { replacements: [groupId], type: QueryTypes.SELECT },
    );
    return { active: Boolean(link), expiresAt: link ? iso(link.expiresAt) : null };
  }
  /** Creates a new code valid for 7 days and retires the previous one. Only the hash is stored. */
  async createInviteLink(userId: string, groupId: string): Promise<GroupInviteLink | "missing" | "forbidden"> {
    const m = await this.membership(userId, groupId);
    if (!m) return "missing";
    if (!privileged(m.role)) return "forbidden";
    const [group] = await this.db.query<{ id: string }>("SELECT id FROM `groups` WHERE id=? AND active=1", { replacements: [groupId], type: QueryTypes.SELECT });
    if (!group) return "missing";
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const code = Array.from(randomBytes(10), (byte) => alphabet[byte % alphabet.length]).join("");
    const id = randomUUID();
    await this.db.transaction(async (t) => {
      await this.db.query("UPDATE group_invite_links SET revoked_at=UTC_TIMESTAMP(6) WHERE group_id=? AND revoked_at IS NULL", { replacements: [groupId], type: QueryTypes.UPDATE, transaction: t });
      await this.db.query(
        "INSERT INTO group_invite_links (id,group_id,code_hash,created_by_user_id,expires_at,created_at) VALUES (?,?,?,?,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 7 DAY),UTC_TIMESTAMP(6))",
        { replacements: [id, groupId, this.codeHash(code), userId], type: QueryTypes.INSERT, transaction: t },
      );
    });
    const [created] = await this.db.query<{ expiresAt: Date }>("SELECT expires_at expiresAt FROM group_invite_links WHERE id=?", { replacements: [id], type: QueryTypes.SELECT });
    return { active: true, expiresAt: iso(created.expiresAt), code };
  }
  async revokeInviteLink(userId: string, groupId: string) {
    const m = await this.membership(userId, groupId);
    if (!m) return "missing" as const;
    if (!privileged(m.role)) return "forbidden" as const;
    await this.db.query("UPDATE group_invite_links SET revoked_at=UTC_TIMESTAMP(6) WHERE group_id=? AND revoked_at IS NULL", { replacements: [groupId], type: QueryTypes.UPDATE });
    return "ok" as const;
  }
  /** What someone holding a code may know before asking: the group's name and size, and where they stand. */
  async joinPreview(userId: string, code: string): Promise<GroupJoinPreview | null> {
    const link = await this.usableLink(code);
    if (!link) return null;
    const member = await this.membership(userId, link.groupId);
    const [pending] = member ? [] : await this.db.query<{ id: string }>(
      "SELECT id FROM group_join_requests WHERE group_id=? AND user_id=? AND status='pending'",
      { replacements: [link.groupId, userId], type: QueryTypes.SELECT },
    );
    return { group: { name: link.name, memberCount: Number(link.memberCount) }, status: member ? "member" : pending ? "pending" : "available" };
  }
  /** Asks to join; nobody enters a group by code without the administration's approval. */
  async requestJoin(userId: string, code: string) {
    return this.db.transaction(async (t) => {
      const link = await this.usableLink(code, t);
      if (!link) return "missing" as const;
      await this.db.query("SELECT id FROM `groups` WHERE id=? FOR UPDATE", { replacements: [link.groupId], type: QueryTypes.SELECT, transaction: t });
      if (await this.membership(userId, link.groupId, t)) return "conflict" as const;
      const pending = await this.db.query<{ user_id: string }>(
        "SELECT user_id FROM group_join_requests WHERE group_id=? AND status='pending'",
        { replacements: [link.groupId], type: QueryTypes.SELECT, transaction: t },
      );
      if (pending.some((row) => row.user_id === userId) || pending.length >= 50) return "conflict" as const;
      await this.db.query(
        "INSERT INTO group_join_requests (id,group_id,user_id,link_id,status,created_at) VALUES (?,?,?,?,'pending',UTC_TIMESTAMP(6))",
        { replacements: [randomUUID(), link.groupId, userId, link.id], type: QueryTypes.INSERT, transaction: t },
      );
      const requester = await this.user(userId, t);
      const staff = await this.db.query<{ user_id: string }>(
        "SELECT user_id FROM group_members WHERE group_id=? AND status='active' AND role IN ('owner','admin')",
        { replacements: [link.groupId], type: QueryTypes.SELECT, transaction: t },
      );
      for (const person of staff)
        await this.notify(person.user_id, "join_request", "Pedido para entrar", `${requester.displayName} pediu para entrar em ${link.name}.`.slice(0, 300), link.groupId, null, t);
      return "ok" as const;
    });
  }
  async joinRequests(userId: string, groupId: string): Promise<GroupJoinRequest[] | "missing" | "forbidden"> {
    const m = await this.membership(userId, groupId);
    if (!m) return "missing";
    if (!privileged(m.role)) return "forbidden";
    const rows = await this.db.query<any>(
      "SELECT r.id,r.created_at createdAt,u.id userId,u.username,COALESCE(u.display_name,CONCAT(u.first_name,' ',u.last_name)) displayName,u.avatar_url avatarUrl FROM group_join_requests r JOIN users u ON u.id=r.user_id WHERE r.group_id=? AND r.status='pending' ORDER BY r.created_at,r.id LIMIT 50",
      { replacements: [groupId], type: QueryTypes.SELECT },
    );
    return rows.map((r: any) => ({ id: r.id, createdAt: iso(r.createdAt), user: { id: r.userId, username: r.username, displayName: r.displayName, avatarUrl: r.avatarUrl } }));
  }
  async decideJoinRequest(actorId: string, groupId: string, requestId: string, decision: "approved" | "declined") {
    const m = await this.membership(actorId, groupId);
    if (!m) return "missing" as const;
    if (!privileged(m.role)) return "forbidden" as const;
    return this.db.transaction(async (t) => {
      const [request] = await this.db.query<{ id: string; user_id: string; status: string; name: string }>(
        "SELECT r.id,r.user_id,r.status,g.name FROM group_join_requests r JOIN `groups` g ON g.id=r.group_id AND g.active=1 WHERE r.id=? AND r.group_id=? FOR UPDATE",
        { replacements: [requestId, groupId], type: QueryTypes.SELECT, transaction: t },
      );
      if (!request) return "missing" as const;
      if (request.status !== "pending") return "conflict" as const;
      await this.db.query(
        "UPDATE group_join_requests SET status=?,decided_by_user_id=?,decided_at=UTC_TIMESTAMP(6) WHERE id=?",
        { replacements: [decision, actorId, requestId], type: QueryTypes.UPDATE, transaction: t },
      );
      if (decision === "approved") {
        await this.activateMember(groupId, request.user_id, t);
        await this.createMemberJoined(groupId, request.user_id, requestId, t);
      }
      await this.notify(request.user_id, "join_request", decision === "approved" ? "Pedido aprovado" : "Pedido não aceito", (decision === "approved" ? `Você agora faz parte de ${request.name}.` : `Seu pedido para entrar em ${request.name} não foi aceito.`).slice(0, 300), decision === "approved" ? groupId : null, null, t);
      return "ok" as const;
    });
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
      await this.activateMember(invite.group_id, userId, t);
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

  async listPosts(userId: string, groupId: string | undefined, before?: string) {
    await this.purgeExpiredPhotos();
    if (groupId && !(await this.membership(userId, groupId))) return null;
    const params: any[] = [userId, userId, ...(groupId ? [groupId] : [])];
    let cursor = "";
    if (before) {
      const [date,id]=before.split('|');
      if(id){cursor=" AND (p.created_at < ? OR (p.created_at = ? AND p.id < ?))";params.push(date,date,id);}
      else{cursor = " AND p.created_at < ?";params.push(new Date(before));}
    }
    const rows = await this.db.query<any>(
      `SELECT DATE_FORMAT(p.created_at,'%Y-%m-%d %H:%i:%s.%f') cursorTime,g.name groupName,g.active groupActive,viewer.role groupRole,p.id,p.group_id groupId,p.author_user_id,p.kind,p.event_type eventType,p.text,p.activity_stats activityStats,(p.photo_data IS NOT NULL OR p.photo_path IS NOT NULL) hasPhoto,p.photo_width photoWidth,p.photo_height photoHeight,p.comments_enabled commentsEnabled,p.created_at createdAt,p.updated_at updatedAt,u.id authorId,u.username,COALESCE(u.display_name,CONCAT(u.first_name,' ',u.last_name)) displayName,u.avatar_url avatarUrl,(SELECT COUNT(*) FROM group_comments c WHERE c.post_id=p.id AND c.deleted_at IS NULL) commentCount FROM group_posts p JOIN \`groups\` g ON g.id=p.group_id JOIN users u ON u.id=p.author_user_id JOIN group_members viewer ON viewer.group_id=p.group_id AND viewer.user_id=? AND viewer.status='active' WHERE NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_user_id=? AND b.blocked_user_id=p.author_user_id) ${groupId ? 'AND p.group_id=?' : 'AND g.active=1'} AND p.deleted_at IS NULL AND p.created_at>=viewer.joined_at${cursor} ORDER BY p.created_at DESC,p.id DESC LIMIT 31`,
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
    const items: import('@fit/contracts').SocialPost[] = visible.map((r: any) => ({
      id: r.id,
      groupId: r.groupId,
      group: { id:r.groupId, name:r.groupName, role:r.groupRole, active:Boolean(r.groupActive) },
      author: {
        id: r.authorId,
        username: r.username,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
      },
      kind: r.kind,
      eventType: r.eventType,
      text: r.text,
      photoUrl: r.hasPhoto ? `/groups/${r.groupId}/posts/${r.id}/photo` : null,
      photoAspectRatio: Number(r.photoWidth)>0&&Number(r.photoHeight)>0 ? Number(r.photoWidth)/Number(r.photoHeight) : null,
      activityStats: r.activityStats ? (typeof r.activityStats === 'string' ? JSON.parse(r.activityStats) : r.activityStats) : null,
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
    storedPhoto?:{mime:string;path:string;width:number;height:number},
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
    let width:number|null=null;
    let height:number|null=null;
    if (input.photoDataUrl&&!storedPhoto) {
      const parsed = await this.photo(input.photoDataUrl);
      if (!parsed) return "invalid_photo" as const;
      ({ mime, data, width, height } = parsed);
    }
    const id = randomUUID();
    const photoPath=storedPhoto?.path??(data?await saveMedia(data):null);
    if(storedPhoto){mime=storedPhoto.mime;width=storedPhoto.width;height=storedPhoto.height;}
    try {
    await this.db.query(
      "INSERT INTO group_posts (id,group_id,author_user_id,kind,text,photo_mime,photo_path,photo_width,photo_height,comments_enabled,created_at,updated_at) VALUES (?,?,?,'manual',?,?,?,?,?,?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))",
      {
        replacements: [
          id,
          groupId,
          userId,
          input.text ?? null,
          mime,
          photoPath,
          width,
          height,
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
      const output=await sharp(data).metadata();
      if(!output.width||!output.height)return null;
      return { mime: "image/webp", data, width:output.width, height:output.height };
    } catch {
      return null;
    }
  }
  private async groupImage(value:string,kind:'avatar'|'cover') {
    try{
      const match=/^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(value);if(!match)return null;
      const original=Buffer.from(match[2],'base64');if(original.length>10*1024*1024)return null;
      const source=sharp(original,{limitInputPixels:40_000_000}).rotate();
      const metadata=await source.metadata();if(!['jpeg','png','webp'].includes(metadata.format??''))return null;
      return kind==='avatar'
        ? await source.resize(512,512,{fit:'cover',position:'centre'}).webp({quality:84}).toBuffer()
        : await source.resize(1600,600,{fit:'cover',position:'centre'}).webp({quality:84}).toBuffer();
    }catch{return null;}
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
    if (!reaction) {
      await this.db.query(
        "DELETE FROM group_post_reactions WHERE post_id=? AND user_id=?",
        { replacements: [postId, userId], type: QueryTypes.DELETE },
      );
      return "ok" as const;
    }
    await this.db.transaction(async (t) => {
      // Reactions to one post are serialized, so the grouped notification is created or updated once.
      await this.db.query("SELECT id FROM group_posts WHERE id=? FOR UPDATE", { replacements: [postId], type: QueryTypes.SELECT, transaction: t });
      const [existing] = await this.db.query<{ id: string }>(
        "SELECT id FROM group_post_reactions WHERE post_id=? AND user_id=?",
        { replacements: [postId, userId], type: QueryTypes.SELECT, transaction: t },
      );
      await this.db.query(
        "INSERT INTO group_post_reactions (id,post_id,user_id,reaction,created_at,updated_at) VALUES (?,?,?,?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE reaction=VALUES(reaction),updated_at=UTC_TIMESTAMP(6)",
        {
          replacements: [randomUUID(), postId, userId, reaction],
          type: QueryTypes.INSERT,
          transaction: t,
        },
      );
      // Only a new reaction tells the author; changing the emoji does not.
      if (!existing && post.author_user_id !== userId) await this.notifyReaction(post.author_user_id, userId, groupId, postId, t);
    });
    return "ok" as const;
  }
  /**
   * One notification per post for the author: while it is unread, new reactions update it instead of adding rows.
   * After it is read, another one is only created an hour later, so toggling a reaction cannot be used to nag.
   */
  private async notifyReaction(authorId: string, reactorId: string, groupId: string, postId: string, t: Transaction) {
    const [allowed] = await this.db.query<{ ok: number }>(
      "SELECT 1 ok FROM group_members m WHERE m.group_id=? AND m.user_id=? AND m.status='active' AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_user_id=m.user_id AND b.blocked_user_id=?)",
      { replacements: [groupId, authorId, reactorId], type: QueryTypes.SELECT, transaction: t },
    );
    if (!allowed) return;
    const [latest] = await this.db.query<{ id: string; unread: number; recent: number }>(
      "SELECT id,read_at IS NULL unread,created_at>=UTC_TIMESTAMP(6)-INTERVAL 1 HOUR recent FROM group_notifications WHERE user_id=? AND type='reaction' AND post_id=? ORDER BY created_at DESC LIMIT 1",
      { replacements: [authorId, postId], type: QueryTypes.SELECT, transaction: t },
    );
    if (latest && !Number(latest.unread) && Number(latest.recent)) return;
    const [count] = await this.db.query<{ total: number }>(
      "SELECT COUNT(*) total FROM group_post_reactions r WHERE r.post_id=? AND r.user_id<>? AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_user_id=? AND b.blocked_user_id=r.user_id)",
      { replacements: [postId, authorId, authorId], type: QueryTypes.SELECT, transaction: t },
    );
    const others = Number(count?.total ?? 1) - 1;
    const reactor = await this.user(reactorId, t);
    const message = (others <= 0
      ? `${reactor.displayName} reagiu à sua publicação.`
      : `${reactor.displayName} e mais ${others} ${others === 1 ? "pessoa" : "pessoas"} reagiram à sua publicação.`).slice(0, 300);
    if (latest && Number(latest.unread))
      await this.db.query(
        "UPDATE group_notifications SET message=?,created_at=UTC_TIMESTAMP(6) WHERE id=?",
        { replacements: [message, latest.id], type: QueryTypes.UPDATE, transaction: t },
      );
    else await this.notify(authorId, "reaction", "Nova reação", message, groupId, postId, t);
  }
  /** Who reacted to a post the viewer can read; people the viewer has hidden are left out. */
  async postReactions(userId: string, groupId: string, postId: string): Promise<GroupPostReaction[] | null> {
    const m = await this.membership(userId, groupId);
    if (!m) return null;
    const [post] = await this.db.query<{ id: string }>(
      "SELECT p.id FROM group_posts p JOIN group_members viewer ON viewer.group_id=p.group_id AND viewer.user_id=? AND viewer.status='active' WHERE p.id=? AND p.group_id=? AND p.created_at>=viewer.joined_at AND p.deleted_at IS NULL",
      { replacements: [userId, postId, groupId], type: QueryTypes.SELECT },
    );
    if (!post) return null;
    const rows = await this.db.query<any>(
      "SELECT r.reaction,r.updated_at reactedAt,u.id,u.username,COALESCE(u.display_name,CONCAT(u.first_name,' ',u.last_name)) displayName,u.avatar_url avatarUrl FROM group_post_reactions r JOIN users u ON u.id=r.user_id WHERE r.post_id=? AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_user_id=? AND b.blocked_user_id=r.user_id) ORDER BY r.updated_at DESC,r.id LIMIT 200",
      { replacements: [postId, userId], type: QueryTypes.SELECT },
    );
    return rows.map((r: any) => ({
      user: { id: r.id, username: r.username, displayName: r.displayName, avatarUrl: r.avatarUrl },
      reaction: r.reaction,
      reactedAt: iso(r.reactedAt),
    }));
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
      "SELECT c.id,c.post_id postId,c.parent_comment_id parentCommentId,c.text,c.deleted_at deletedAt,c.created_at createdAt,c.updated_at updatedAt,u.id authorId,u.username,COALESCE(u.display_name,CONCAT(u.first_name,' ',u.last_name)) displayName,u.avatar_url avatarUrl FROM group_comments c JOIN users u ON u.id=c.author_user_id WHERE c.post_id=? ORDER BY c.created_at,c.id",
      { replacements: [postId], type: QueryTypes.SELECT },
    );
    const counts = rows.length ? await this.db.query<{commentId:string;reaction:GroupReaction;count:number;reactedByMe:number}>(
      "SELECT comment_id commentId,reaction,COUNT(*) count,MAX(user_id=?) reactedByMe FROM group_comment_reactions WHERE comment_id IN (?) GROUP BY comment_id,reaction",
      {replacements:[userId,rows.map((r:any)=>r.id)],type:QueryTypes.SELECT},
    ) : [];
    return rows.map((r: any) => ({
      id: r.id,
      postId: r.postId,
      parentCommentId: r.parentCommentId,
      reactionCounts: r.deletedAt ? [] : counts.filter(count=>count.commentId===r.id).map(count=>({reaction:count.reaction,count:Number(count.count),reactedByMe:Boolean(count.reactedByMe)})),
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
    if (input.parentCommentId) {
      const [parent] = await this.db.query<{parentId:string|null}>(
        "SELECT parent_comment_id parentId FROM group_comments WHERE id=? AND post_id=? AND deleted_at IS NULL",
        {replacements:[input.parentCommentId,postId],type:QueryTypes.SELECT},
      );
      if (!parent || parent.parentId) return "missing" as const;
    }
    const id = randomUUID();
    await this.db.transaction(async (t) => {
      await this.db.query(
        "INSERT INTO group_comments (id,post_id,author_user_id,text,parent_comment_id,created_at,updated_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))",
        {
          replacements: [id, postId, userId, input.text, input.parentCommentId ?? null],
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
  async reactToComment(userId:string,groupId:string,commentId:string,reaction:GroupReaction|null) {
    if (!(await this.membership(userId,groupId))) return "missing" as const;
    const [comment] = await this.db.query<{id:string}>(
      "SELECT c.id FROM group_comments c JOIN group_posts p ON p.id=c.post_id JOIN group_members m ON m.group_id=p.group_id AND m.user_id=? AND m.status='active' WHERE c.id=? AND p.group_id=? AND c.deleted_at IS NULL AND p.deleted_at IS NULL AND p.created_at>=m.joined_at",
      {replacements:[userId,commentId,groupId],type:QueryTypes.SELECT},
    );
    if (!comment) return "missing" as const;
    if (reaction === null) await this.db.query("DELETE FROM group_comment_reactions WHERE comment_id=? AND user_id=?",{replacements:[commentId,userId],type:QueryTypes.DELETE});
    else await this.db.query("INSERT INTO group_comment_reactions (id,comment_id,user_id,reaction,created_at,updated_at) VALUES (?,?,?,?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE reaction=VALUES(reaction),updated_at=UTC_TIMESTAMP(6)",{replacements:[randomUUID(),commentId,userId,reaction],type:QueryTypes.INSERT});
    return "ok" as const;
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

  async markSeen(userId: string, groupId: string, postId?:string) {
    if (!(await this.membership(userId, groupId))) return false;
    if(postId){
      const [post]=await this.db.query<{seenAt:string}>("SELECT DATE_FORMAT(p.created_at,'%Y-%m-%d %H:%i:%s.%f') seenAt FROM group_posts p JOIN group_members m ON m.group_id=p.group_id AND m.user_id=? AND m.status='active' WHERE p.id=? AND p.group_id=? AND p.deleted_at IS NULL AND p.created_at>=m.joined_at AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_user_id=? AND b.blocked_user_id=p.author_user_id)",{replacements:[userId,postId,groupId,userId],type:QueryTypes.SELECT});
      if(!post)return false;
      await this.db.query("UPDATE group_members SET last_seen_at=GREATEST(COALESCE(last_seen_at,joined_at),LEAST(?,UTC_TIMESTAMP(6))),updated_at=UTC_TIMESTAMP(6) WHERE group_id=? AND user_id=? AND status='active'",{replacements:[post.seenAt,groupId,userId],type:QueryTypes.UPDATE});
    }else await this.db.query("UPDATE group_members SET last_seen_at=UTC_TIMESTAMP(6),updated_at=UTC_TIMESTAMP(6) WHERE group_id=? AND user_id=? AND status='active'",{replacements:[groupId,userId],type:QueryTypes.UPDATE});
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
        "SELECT COUNT(*) total,COALESCE(SUM(CASE WHEN p.author_user_id<>m.user_id AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_user_id=m.user_id AND b.blocked_user_id=p.author_user_id) THEN 1 ELSE 0 END),0) postsUnseen FROM group_posts p JOIN group_members m ON m.group_id=p.group_id AND m.user_id=? AND m.status='active' WHERE p.deleted_at IS NULL AND p.created_at>=m.joined_at AND p.created_at>COALESCE(m.last_seen_at,m.joined_at)",
        { replacements: [userId], type: QueryTypes.SELECT },
      ),
      this.db.query<any>(
        "SELECT COUNT(*) total FROM group_comments c JOIN group_posts p ON p.id=c.post_id JOIN group_members m ON m.group_id=p.group_id AND m.user_id=? AND m.status='active' WHERE c.deleted_at IS NULL AND c.author_user_id<>m.user_id AND p.created_at>=m.joined_at AND c.created_at>COALESCE(m.last_seen_at,m.joined_at)",
        { replacements: [userId], type: QueryTypes.SELECT },
      ),
      this.db.query<any>(
        "SELECT COUNT(*) total FROM group_post_reactions r JOIN group_posts p ON p.id=r.post_id JOIN group_members m ON m.group_id=p.group_id AND m.user_id=? AND m.status='active' WHERE r.user_id<>m.user_id AND p.created_at>=m.joined_at AND r.created_at>COALESCE(m.last_seen_at,m.joined_at)",
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
      postsUnseen: Number(unseenPosts?.postsUnseen ?? 0),
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
      `SELECT m.group_id groupId,(g.allow_activity_stats=1 AND p.share_activity_stats=1) withStats FROM group_members m JOIN \`groups\` g ON g.id=m.group_id JOIN group_event_settings s ON s.group_id=g.id JOIN group_share_preferences p ON p.group_id=g.id AND p.user_id=m.user_id WHERE m.user_id=? AND m.status='active' AND g.active=1 AND s.${eventType}=1 AND p.${eventType}=1`,
      { replacements: [userId], type: QueryTypes.SELECT },
    );
    const user = await this.user(userId);
    const stats = rows.some((row: any) => row.withStats) ? await this.activityStats(userId, sourceType, sourceId) : null;
    for (const row of rows) {
      await this.db.query(
        `INSERT IGNORE INTO group_posts (id,group_id,author_user_id,kind,event_type,text,activity_stats,comments_enabled,source_type,source_id,created_at,updated_at) SELECT ?,?,?, 'event',?,?,?,comments_enabled,?,?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6) FROM \`groups\` WHERE id=?`,
        {
          replacements: [
            randomUUID(),
            row.groupId,
            userId,
            eventType,
            `${user.displayName} ${textMap[eventType]}`,
            row.withStats && stats ? JSON.stringify(stats) : null,
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
      const allowedGroups: { id: string; comments: boolean; withStats: boolean }[] = [];
      for (const groupId of ids) {
        const [allowed] = await this.db.query<{ comments: boolean; withStats: number }>(
          `SELECT g.comments_enabled comments,(g.allow_activity_stats=1 AND COALESCE((SELECT sp.share_activity_stats FROM group_share_preferences sp WHERE sp.group_id=g.id AND sp.user_id=m.user_id),0)=1) withStats FROM group_members m JOIN \`groups\` g ON g.id=m.group_id JOIN group_event_settings s ON s.group_id=g.id WHERE m.user_id=? AND m.group_id=? AND m.status='active' AND g.active=1 AND s.${eventType}=1 FOR UPDATE`,
          { replacements: [userId, groupId], type: QueryTypes.SELECT, transaction },
        );
        if (!allowed) return 'forbidden' as const;
        allowedGroups.push({ id: groupId, comments: Boolean(allowed.comments), withStats: Boolean(Number(allowed.withStats)) });
      }
      const user = await this.user(userId, transaction);
      const stats = allowedGroups.some(group => group.withStats) ? await this.activityStats(userId, sourceType, sourceId, transaction) : null;
      let created = 0;
      for (const group of allowedGroups) {
        const [, count] = await this.db.query(
          "INSERT IGNORE INTO group_posts (id,group_id,author_user_id,kind,event_type,text,activity_stats,comments_enabled,source_type,source_id,created_at,updated_at) VALUES (?,?,?,'event',?,?,?,?,?,?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))",
          { replacements: [randomUUID(), group.id, userId, eventType, `${user.displayName} concluiu um ${sourceType === 'workout_session' ? 'treino' : 'cardio'} hoje!`, group.withStats && stats ? JSON.stringify(stats) : null, group.comments, sourceType, sourceId], type: QueryTypes.INSERT, transaction },
        );
        if (Number(count) > 0) created++;
      }
      return created;
    });
  }

  /**
   * Duration, exercises and sets of the person's own workout or cardio, for groups where they chose to show them.
   * Never includes loads, exercise names or the plan.
   */
  private async activityStats(userId: string, sourceType: string, sourceId: string, t?: Transaction): Promise<GroupActivityStats | null> {
    if (sourceType === "cardio_session") {
      const [cardio] = await this.db.query<{ minutes: number | null }>(
        "SELECT duration_minutes minutes FROM cardio_sessions WHERE id=? AND user_id=?",
        { replacements: [sourceId, userId], type: QueryTypes.SELECT, transaction: t },
      );
      return cardio?.minutes != null ? { durationMinutes: Math.round(Number(cardio.minutes)), exercises: null, sets: null } : null;
    }
    if (sourceType !== "workout_session") return null;
    const [session] = await this.db.query<{ ids: unknown }>(
      "SELECT completed_exercise_ids ids FROM workout_sessions WHERE id=? AND user_id=?",
      { replacements: [sourceId, userId], type: QueryTypes.SELECT, transaction: t },
    );
    if (!session) return null;
    const [run] = await this.db.query<{ progress: unknown }>(
      "SELECT progress FROM workout_runs WHERE history_session_id=? AND user_id=? LIMIT 1",
      { replacements: [sourceId, userId], type: QueryTypes.SELECT, transaction: t },
    );
    const parse = (value: unknown) => typeof value === "string" ? JSON.parse(value) : value;
    const progress = run ? parse(run.progress) as { startedAt?: number; finishedAt?: number | null; pausedMs?: number; exercises?: { completedSets?: number[] }[] } : null;
    if (progress?.exercises) {
      const sets = progress.exercises.reduce((total, exercise) => total + (exercise.completedSets?.length ?? 0), 0);
      const elapsed = progress.startedAt && progress.finishedAt ? progress.finishedAt - progress.startedAt - (progress.pausedMs ?? 0) : null;
      return { durationMinutes: elapsed != null && elapsed > 0 ? Math.max(1, Math.round(elapsed / 60_000)) : null, exercises: progress.exercises.filter(exercise => (exercise.completedSets?.length ?? 0) > 0).length, sets };
    }
    const ids = parse(session.ids);
    return Array.isArray(ids) && ids.length ? { durationMinutes: null, exercises: ids.length, sets: null } : null;
  }
  async detachActivity(userId: string, sourceType: string, sourceId: string) {
    await this.db.query(
      "UPDATE group_posts SET text=text WHERE author_user_id=? AND source_type=? AND source_id=?",
      { replacements: [userId, sourceType, sourceId], type: QueryTypes.UPDATE },
    );
  }
}
