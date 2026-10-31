import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { config } from "dotenv";
import { QueryTypes } from "sequelize";
import { buildApp } from "../src/app.js";
import { createDatabase } from "../src/database.js";
import { GroupRepository } from "../src/group-repository.js";
import { migrateDatabase } from "../src/migrate.js";
import { SequelizeAuthRepository } from "../src/repository.js";
import sharp from 'sharp';
import {readMedia} from '../src/media-storage.js';

test(
  "MySQL: grupos isolam feed, respeitam entrada, papéis e consentimento",
  { skip: process.env.RUN_DB_TESTS !== "1" },
  async () => {
    config({ path: new URL("../.env", import.meta.url), quiet: true });
    const db = createDatabase({
      host: process.env.DB_HOST!,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USER!,
      password: process.env.DB_PASS!,
      database: process.env.DB_NAME!,
      ssl: process.env.DB_SSL === "true",
    });
    const userIds: string[] = [];
    const groupIds: string[] = [];
    await migrateDatabase(db);
    const groups = new GroupRepository(db);
    const app = await buildApp({
      repository: new SequelizeAuthRepository(db),
      groupRepository: groups,
      jwtSecret: "groups-integration-secret-more-than-32",
    });
    try {
      const accounts = [];
      for (const role of ["owner", "member", "outsider"]) {
        const response = await app.inject({
          method: "POST",
          url: "/auth/register",
          payload: {
            email: `group-${role}-${randomUUID()}@example.com`,
            password: "integration-test-123",
            phone: "71999990000",
            firstName: role,
            lastName: "Teste",
          },
        });
        assert.equal(response.statusCode, 201);
        accounts.push(response.json());
        userIds.push(response.json().user.id);
      }
      const owner = { authorization: `Bearer ${accounts[0].accessToken}` };
      const member = { authorization: `Bearer ${accounts[1].accessToken}` };
      const outsider = { authorization: `Bearer ${accounts[2].accessToken}` };
      const created = await app.inject({
        method: "POST",
        url: "/groups",
        headers: owner,
        payload: { name: "Grupo seguro", description: "Integração" },
      });
      assert.equal(created.statusCode, 201);
      const groupId = created.json().id;
      groupIds.push(groupId);
      const oldPost = await app.inject({
        method: "POST",
        url: `/groups/${groupId}/posts`,
        headers: owner,
        payload: { text: "Antes da entrada" },
      });
      assert.equal(oldPost.statusCode, 201);
      assert.equal(
        (
          await app.inject({
            method: "GET",
            url: `/groups/${groupId}`,
            headers: outsider,
          })
        ).statusCode,
        404,
      );
      const invite = await app.inject({
        method: "POST",
        url: `/groups/${groupId}/invites`,
        headers: owner,
        payload: { username: accounts[1].user.username },
      });
      assert.equal(invite.statusCode, 201);
      const received = await app.inject({
        method: "GET",
        url: "/groups/invites",
        headers: member,
      });
      assert.equal(received.statusCode, 200);
      assert.equal(received.json().length, 1);
      assert.equal(
        (
          await app.inject({
            method: "PATCH",
            url: `/groups/invites/${received.json()[0].id}`,
            headers: member,
            payload: { decision: "accepted" },
          })
        ).statusCode,
        204,
      );
      const firstFeed = await app.inject({
        method: "GET",
        url: `/groups/${groupId}/posts`,
        headers: member,
      });
      assert.equal(firstFeed.statusCode, 200);
      assert.equal(
        firstFeed
          .json()
          .items.some((post: any) => post.text === "Antes da entrada"),
        false,
      );
      const newPost = await app.inject({
        method: "POST",
        url: `/groups/${groupId}/posts`,
        headers: owner,
        payload: { text: "Depois da entrada" },
      });
      assert.equal(newPost.statusCode, 201);
      const postId = newPost.json().id;
      // Hidden people are listed only for the person who hid them and can be restored.
      assert.equal((await app.inject({ method: 'GET', url: '/users/blocked' })).statusCode, 401);
      assert.equal((await app.inject({ method: 'PUT', url: `/users/${accounts[1].user.id}/block`, headers: owner, payload: { blocked: true } })).statusCode, 204);
      assert.deepEqual((await app.inject({ method: 'GET', url: '/users/blocked', headers: owner })).json().map((person: { id: string }) => person.id), [accounts[1].user.id]);
      assert.deepEqual((await app.inject({ method: 'GET', url: '/users/blocked', headers: outsider })).json(), []);
      assert.equal((await app.inject({ method: 'PUT', url: `/users/${accounts[1].user.id}/block`, headers: owner, payload: { blocked: false } })).statusCode, 204);
      assert.deepEqual((await app.inject({ method: 'GET', url: '/users/blocked', headers: owner })).json(), []);
      const secondGroup=await groups.create(accounts[0].user.id,{name:'Segundo destino'});groupIds.push(secondGroup);
      const image=await sharp({create:{width:800,height:600,channels:3,background:'blue'}}).png().toBuffer();
      const shared=await app.inject({method:'POST',url:'/groups/posts',headers:owner,payload:{groupIds:[groupId,secondGroup],photoDataUrl:`data:image/png;base64,${image.toString('base64')}`}});
      assert.equal(shared.statusCode,201);
      const imageRows=await db.query<{id:string;photo_path:string;photo_data:Buffer|null}>('SELECT id,photo_path,photo_data FROM group_posts WHERE id IN (?)',{replacements:[shared.json().ids],type:QueryTypes.SELECT});
      assert.equal(imageRows.length,2);assert.equal(imageRows[0].photo_path,imageRows[1].photo_path);assert.equal(imageRows[0].photo_data,null);
      const file=await readMedia(imageRows[0].photo_path);assert.equal((await sharp(file).metadata()).format,'webp');
      const download=await app.inject({method:'GET',url:`/groups/${groupId}/posts/${shared.json().ids[0]}/photo`,headers:owner});assert.equal(download.statusCode,200);assert.equal(download.headers['content-type'],'image/webp');
      assert.equal((await app.inject({method:'GET',url:`/groups/${groupId}/posts/${shared.json().ids[0]}/photo`,headers:outsider})).statusCode,404);
      await db.query('UPDATE group_posts SET created_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 49 HOUR) WHERE id=?',{replacements:[imageRows[0].id],type:QueryTypes.UPDATE});await groups.purgeExpiredPhotos();assert.ok((await readMedia(imageRows[0].photo_path)).length);
      await db.query('UPDATE group_posts SET created_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 49 HOUR) WHERE id=?',{replacements:[imageRows[1].id],type:QueryTypes.UPDATE});await groups.purgeExpiredPhotos();await assert.rejects(()=>readMedia(imageRows[0].photo_path));
      const multi=await app.inject({method:'POST',url:'/groups/posts',headers:owner,payload:{groupIds:[groupId],text:'Publicação conjunta'}});
      assert.equal(multi.statusCode,201);
      assert.equal(multi.json().ids.length,1);
      assert.equal((await app.inject({method:'POST',url:'/groups/posts',headers:outsider,payload:{groupIds:[groupId],text:'Sem acesso'}})).statusCode,404);
      await db.query("UPDATE group_posts SET photo_data=?,photo_mime='image/webp',created_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 49 HOUR) WHERE id=?",{replacements:[Buffer.from('expired-image'),multi.json().ids[0]],type:QueryTypes.UPDATE});
      await groups.purgeExpiredPhotos();
      const expired=await db.query('SELECT id FROM group_posts WHERE id=?',{replacements:[multi.json().ids[0]],type:QueryTypes.SELECT});
      assert.equal(expired.length,0);
      const retained=await db.query('SELECT id FROM group_posts WHERE id=?',{replacements:[postId],type:QueryTypes.SELECT});
      assert.equal(retained.length,1);
      const feed = await app.inject({
        method: "GET",
        url: `/groups/${groupId}/posts`,
        headers: member,
      });
      assert.equal(feed.statusCode, 200);
      assert.equal(
        feed.json().items.some((post: any) => post.id === postId),
        true,
      );
      assert.equal(
        (
          await app.inject({
            method: "PATCH",
            url: `/groups/${groupId}`,
            headers: member,
            payload: { name: "Sem permissão" },
          })
        ).statusCode,
        403,
      );
      assert.equal(
        (
          await app.inject({
            method: "PUT",
            url: `/groups/${groupId}/posts/${postId}/reaction`,
            headers: member,
            payload: { reaction: "strength" },
          })
        ).statusCode,
        204,
      );
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: `/groups/${groupId}/posts/${postId}/comments`,
            headers: member,
            payload: { text: "Boa!" },
          })
        ).statusCode,
        201,
      );
      const notifications = await app.inject({
        method: "GET",
        url: "/groups/notifications",
        headers: owner,
      });
      assert.equal(notifications.statusCode, 200);
      assert.equal(
        notifications.json().some((item: any) => item.type === "comment"),
        true,
      );
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: `/groups/${groupId}/reports`,
            headers: member,
            payload: { targetType: "post", targetId: postId, reason: "spam" },
          })
        ).statusCode,
        201,
      );
      assert.equal(
        (
          await app.inject({
            method: "GET",
            url: `/groups/${groupId}/reports`,
            headers: member,
          })
        ).statusCode,
        403,
      );
      assert.equal(
        (
          await app.inject({
            method: "PATCH",
            url: `/groups/${groupId}/members/${accounts[1].user.id}`,
            headers: owner,
            payload: { role: "moderator" },
          })
        ).statusCode,
        204,
      );
      assert.equal(
        (
          await app.inject({
            method: "GET",
            url: `/groups/${groupId}/reports`,
            headers: member,
          })
        ).statusCode,
        200,
      );
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: `/groups/${groupId}/invites`,
            headers: member,
            payload: { username: accounts[2].user.username },
          })
        ).statusCode,
        403,
      );
      assert.equal(
        (
          await app.inject({
            method: "PUT",
            url: `/groups/${groupId}/events`,
            headers: owner,
            payload: {
              workout_completed: false,
              cardio_completed: true,
              weekly_goal: true,
              weekly_streak: true,
              member_joined: true,
            },
          })
        ).statusCode,
        204,
      );
      assert.equal(
        (
          await app.inject({
            method: "PUT",
            url: `/groups/${groupId}/preferences`,
            headers: member,
            payload: {
              workout_completed: true,
              cardio_completed: false,
              weekly_goal: false,
              weekly_streak: false,
            },
          })
        ).statusCode,
        409,
      );
      assert.equal(
        (
          await app.inject({
            method: "DELETE",
            url: `/groups/${groupId}/members/${accounts[1].user.id}`,
            headers: owner,
          })
        ).statusCode,
        204,
      );
      assert.equal(
        (
          await app.inject({
            method: "GET",
            url: `/groups/${groupId}`,
            headers: member,
          })
        ).statusCode,
        404,
      );
      for(let index=0;index<35;index++)await groups.createPost(accounts[0].user.id,groupId,{text:`Página ${index}`});
      const pageOne=await app.inject({method:'GET',url:`/groups/${groupId}/posts`,headers:owner});assert.equal(pageOne.statusCode,200);assert.equal(pageOne.json().items.length,30);assert.ok(pageOne.json().nextCursor);
      const pageTwo=await app.inject({method:'GET',url:`/groups/${groupId}/posts?before=${encodeURIComponent(pageOne.json().nextCursor)}`,headers:owner});assert.equal(pageTwo.statusCode,200);assert.ok(pageTwo.json().items.length>0);
      const ids=[...pageOne.json().items,...pageTwo.json().items].map((post:any)=>post.id);assert.equal(new Set(ids).size,ids.length);assert.equal([...pageOne.json().items,...pageTwo.json().items].filter((post:any)=>post.text?.startsWith('Página ')).length,35);
    } finally {
      for (const groupId of groupIds)
        await db.query("DELETE FROM `groups` WHERE id=?", {
          replacements: [groupId],
          type: QueryTypes.DELETE,
        });
      if (userIds.length)
        await db.query("DELETE FROM users WHERE id IN (?)", {
          replacements: [userIds],
          type: QueryTypes.DELETE,
        });
      await app.close();
      await db.close();
    }
  },
);
