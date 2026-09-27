import assert from 'node:assert/strict'
import { createCommunityDb, IDS } from './community-db-harness.mjs'

const results = []
async function check(name, fn, options = {}) {
  let fixture
  const start = Date.now()
  try {
    fixture = await createCommunityDb(options)
    await fn(fixture)
    results.push({name,pass:true,ms:Date.now()-start})
    console.log(`PASS ${name}`)
  } catch (error) {
    results.push({name,pass:false,error:error.message,code:error.code,ms:Date.now()-start})
    console.log(`FAIL ${name}: ${error.message}`)
  } finally { if (fixture) await fixture.db.close() }
}
const rows = async (f, uid, sql, args=[]) => (await f.queryAs(uid,sql,args)).rows
const call = (f,uid,name,args=[]) => rows(f,uid,`select * from public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')})`,args)
const news = (f,uid) => call(f,uid,'get_community_news',[500])
const createDiaryComment = async (f,uid,text,parent=null) => {
  const result=(await call(f,uid,'create_diary_comment',[IDS.diary,text,`Fixture ${uid===IDS.A?'A':uid===IDS.B?'B':'C'}`,parent]))[0]
  assert.ok(result.comment_id,JSON.stringify(result))
  assert.equal(result.awarded,0,'Fixture intentionally stubs point awards')
  return result.comment_id
}

await check('baseline reproduces missing reply notification',async f=>{
  const parent=await createDiaryComment(f,IDS.B,'B original comment')
  const reply=await createDiaryComment(f,IDS.A,'A replies to B',parent)
  const before=await call(f,IDS.B,'get_my_news',[100])
  assert.ok(!before.some(x=>x.comment_text==='A replies to B'))
  assert.ok(reply)
},{applyNew:false})

await check('A diary / B comment / A reply notifies B with exact comment id',async f=>{
  const parent=await createDiaryComment(f,IDS.B,'B original comment')
  const reply=await createDiaryComment(f,IDS.A,'A replies to B',parent)
  const bnews=await news(f,IDS.B)
  assert.equal(bnews.filter(n=>n.comment_id===reply).length,1)
  assert.equal(bnews.find(n=>n.comment_id===reply).kind,'diary_reply')
  assert.equal(bnews.find(n=>n.comment_id===reply).target_id,IDS.diary)
  assert.equal(bnews.find(n=>n.comment_id===reply).actor_user_id,IDS.A)
  const anews=await news(f,IDS.A)
  assert.ok(anews.some(n=>n.comment_id===parent&&n.kind==='diary_comment'))
  assert.ok(!anews.some(n=>n.comment_id===reply),'Self reply must not notify self')
  const legacy=await call(f,IDS.B,'get_my_news',[100])
  assert.ok(legacy.some(n=>n.kind==='diary_reply'&&n.comment_text==='A replies to B'))
  assert.ok(!('comment_id' in legacy[0]),'Legacy return schema unchanged')
})

await check('third-party reply notifies both recipients once; same recipient deduplicates',async f=>{
  const parent=await createDiaryComment(f,IDS.B,'B comment')
  const reply=await createDiaryComment(f,IDS.C,'C answers B',parent)
  assert.equal((await news(f,IDS.A)).filter(n=>n.comment_id===reply&&n.kind==='diary_comment').length,1)
  assert.equal((await news(f,IDS.B)).filter(n=>n.comment_id===reply&&n.kind==='diary_reply').length,1)
  const ownParent=await createDiaryComment(f,IDS.A,'A self comment')
  const ownReply=await createDiaryComment(f,IDS.B,'B answers A',ownParent)
  assert.equal((await news(f,IDS.A)).filter(n=>n.comment_id===ownReply).length,1)
})

await check('hidden diary and hidden parent are excluded from thread and news',async f=>{
  const parent=await createDiaryComment(f,IDS.B,'B comment')
  const reply=await createDiaryComment(f,IDS.A,'A reply',parent)
  const thread=await call(f,IDS.B,'get_diary_comment_thread',[IDS.diary,50,0])
  assert.ok(thread.some(c=>c.id===reply&&c.parent_comment_id===parent&&c.user_id===IDS.A))
  await f.db.query("update diary_comments set status='hidden' where id=$1",[parent])
  assert.equal((await call(f,null,'get_diary_comment_thread',[IDS.diary,50,0])).length,0)
  assert.equal((await call(f,null,'get_diary_comments',[IDS.diary,50,0])).length,0)
  assert.ok(!(await news(f,IDS.B)).some(n=>n.comment_id===reply))
  assert.equal((await call(f,null,'get_community_diary',[IDS.diary]))[0].comment_count,0)
  await f.db.query("update diary_comments set status='visible' where id=$1",[parent])
  await f.db.query("update diaries set status='hidden' where id=$1",[IDS.diary])
  assert.equal((await call(f,null,'get_diary_comment_thread',[IDS.diary,50,0])).length,0)
  assert.equal((await call(f,null,'get_community_diary',[IDS.diary])).length,0)
  assert.ok(!(await news(f,IDS.B)).some(n=>n.target_id===IDS.diary))
})

await check('old diary lookup is by exact id and past published answer remains reachable',async f=>{
  await f.db.query("insert into diaries(user_id,nickname,content,created_at) select $1,'Fixture B','Newer diary '||n,now()-n*interval '1 hour' from generate_series(1,45) n",[IDS.B])
  const recent=await call(f,null,'get_diary_feed',['recent',30,0])
  assert.ok(!recent.some(d=>d.id===IDS.diary))
  const exact=await call(f,null,'get_community_diary',[IDS.diary])
  assert.equal(exact.length,1);assert.equal(exact[0].id,IDS.diary)
  assert.equal((await call(f,null,'get_community_diary',[IDS.absent])).length,0)
  const oldAnswer=await call(f,null,'get_community_answer',[IDS.answer])
  assert.equal(oldAnswer.length,1);assert.equal(oldAnswer[0].question_id,IDS.question)
  assert.equal(oldAnswer[0].question,'Old published question')
  assert.equal((await call(f,null,'get_community_answer',[IDS.hiddenAnswer])).length,0)
  assert.equal((await call(f,null,'get_community_answer',[IDS.unpublishedAnswer])).length,0)
})

await check('board/answer comment visibility, exact ids, and privacy-safe actor links',async f=>{
  const boardComment=(await call(f,IDS.B,'create_board_comment',[IDS.board,'B board comment','Fixture B']))[0].comment_id
  const answerComment=(await call(f,IDS.B,'create_answer_comment',[IDS.answer,'B answer comment','Fixture B']))[0].comment_id
  assert.ok(boardComment&&answerComment)
  const notifications=await news(f,IDS.A)
  for(const id of [boardComment,answerComment]){
    const entry=notifications.find(n=>n.comment_id===id)
    assert.ok(entry);assert.equal(entry.actor_user_id,null)
  }
  assert.equal((await call(f,null,'get_board_comments',[IDS.board,50,0])).length,1)
  assert.equal((await call(f,null,'get_answer_comments',[IDS.answer,50,0])).length,1)
  await f.db.query("update board_posts set status='hidden' where id=$1",[IDS.board])
  await f.db.query("update daily_questions set status='draft' where id=$1",[IDS.question])
  assert.equal((await call(f,null,'get_board_comments',[IDS.board,50,0])).length,0)
  assert.equal((await call(f,null,'get_answer_comments',[IDS.answer,50,0])).length,0)
  assert.ok(!(await news(f,IDS.A)).some(n=>[boardComment,answerComment].includes(n.comment_id)))
})

await check('read watermark preserves later arrivals and never regresses or accepts future time',async f=>{
  const early=await createDiaryComment(f,IDS.B,'Earlier notification')
  await f.db.query("update diary_comments set created_at=now()-interval '2 minutes' where id=$1",[early])
  const oldItem=(await news(f,IDS.A)).find(n=>n.comment_id===early)
  const late=await createDiaryComment(f,IDS.C,'Later notification')
  await call(f,IDS.A,'mark_community_news_seen',[oldItem.created_at])
  const after=await news(f,IDS.A)
  assert.equal(after.find(n=>n.comment_id===early).is_new,false)
  assert.equal(after.find(n=>n.comment_id===late).is_new,true)
  const seen1=(await f.db.query('select seen_at from news_seen where user_id=$1',[IDS.A])).rows[0].seen_at
  await call(f,IDS.A,'mark_community_news_seen',['2000-01-01T00:00:00Z'])
  const seen2=(await f.db.query('select seen_at from news_seen where user_id=$1',[IDS.A])).rows[0].seen_at
  assert.equal(new Date(seen2).getTime(),new Date(seen1).getTime())
  await call(f,IDS.A,'mark_community_news_seen',['2100-01-01T00:00:00Z'])
  const future=(await f.db.query('select seen_at <= now() as safe from news_seen where user_id=$1',[IDS.A])).rows[0]
  assert.equal(future.safe,true)
  await call(f,IDS.B,'mark_community_news_seen',[null])
  assert.equal((await f.db.query('select count(*)::int as n from news_seen where user_id=$1',[IDS.B])).rows[0].n,0)
})

await check('anon/public read grants; authenticated-only notifications and writes',async f=>{
  const role=(await rows(f,IDS.B,'select current_user as role, auth.uid() as id'))[0]
  assert.equal(role.role,'authenticated');assert.equal(role.id,IDS.B)
  await call(f,null,'get_community_diary',[IDS.diary])
  await call(f,null,'get_community_answer',[IDS.answer])
  await call(f,null,'get_diary_comment_thread',[IDS.diary,50,0])
  for(const [name,args] of [
    ['get_community_news',[10]],['get_my_news',[10]],['mark_community_news_seen',[new Date().toISOString()]],
    ['request_friend',[IDS.B]],['create_diary_comment',[IDS.diary,'Denied anon write',null,null]],
  ]){
    await assert.rejects(()=>call(f,null,name,args),e=>e.code==='42501',`anon must not execute ${name}`)
  }
  const unauthClaim=(await f.queryAs(null,'select * from public.get_community_news(10)',[],'authenticated')).rows
  assert.equal(unauthClaim.length,0)
  await assert.rejects(()=>rows(f,IDS.B,'select * from auth.users'),e=>e.code==='42501')
})

await check('friend request/receive/accept/news/cancel/self/missing user',async f=>{
  assert.equal((await call(f,IDS.A,'request_friend',[IDS.A]))[0].status,'self')
  assert.equal((await call(f,IDS.A,'request_friend',[IDS.absent]))[0].status,'none')
  assert.equal((await call(f,IDS.A,'request_friend',[IDS.B]))[0].status,'requested')
  assert.equal((await call(f,IDS.A,'get_friend_statuses',[[IDS.B]]))[0].status,'requested')
  assert.equal((await call(f,IDS.B,'get_friend_statuses',[[IDS.A]]))[0].status,'received')
  assert.equal((await news(f,IDS.B)).filter(n=>n.kind==='friend_request'&&n.target_id===IDS.A).length,1)
  assert.equal((await call(f,IDS.B,'respond_friend',[IDS.A,true]))[0].respond_friend,true)
  assert.equal((await call(f,IDS.A,'get_my_friends')).length,1)
  assert.equal((await call(f,IDS.B,'get_my_friends')).length,1)
  assert.equal((await news(f,IDS.A)).filter(n=>n.kind==='friend_accept'&&n.target_id===IDS.B).length,1)
  assert.equal((await call(f,IDS.A,'remove_friend',[IDS.B]))[0].remove_friend,true)
  assert.equal((await call(f,IDS.A,'get_my_friends')).length,0)
  await call(f,IDS.A,'request_friend',[IDS.B])
  assert.equal((await call(f,IDS.A,'remove_friend',[IDS.B]))[0].remove_friend,true)
  assert.equal((await call(f,IDS.B,'get_friend_requests')).length,0)
  await call(f,IDS.A,'request_friend',[IDS.B])
  assert.equal((await call(f,IDS.B,'respond_friend',[IDS.A,false]))[0].respond_friend,true)
  assert.equal((await call(f,IDS.A,'get_friend_requests')).length,0)
  await call(f,IDS.A,'request_friend',[IDS.B])
  assert.equal((await call(f,IDS.B,'request_friend',[IDS.A]))[0].status,'friends')
  assert.equal((await f.db.query('select count(*)::int as n from friendships')).rows[0].n,1)
})

console.log(JSON.stringify({passed:results.filter(r=>r.pass).length,total:results.length,results,limitations:[
  'In-memory PGlite; no production connection or mutations.',
  'Actual saved production function bodies and actual proposed SQL are loaded unchanged.',
  'Minimal test schema; auth.uid JWT claim emulation and claim_mission zero-point stub.',
  'Roles verify RPC EXECUTE grants; complete production RLS/Storage/Auth not reproduced.',
  'Single PGlite connection does not validate true multi-session lock concurrency.'
]},null,2))
if(results.some(r=>!r.pass))process.exitCode=1
