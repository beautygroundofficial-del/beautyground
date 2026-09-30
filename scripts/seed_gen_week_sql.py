import json, re, uuid, os

# seed_gen_week_plan.py의 출력을 실행용 SQL로 변환 — 2026-09-29
# 사용법: python scripts/seed_gen_week_sql.py  → scripts/seed_output/week_batch.sql
#   생성된 SQL은 반드시 내용 확인 후 대표님 승인 → node scripts/db_query.mjs scripts/seed_output/week_batch.sql 로 실행.

BASE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(BASE, "seed_output")
plan = json.load(open(os.path.join(OUT_DIR, "week_plan.json"), encoding="utf-8"))

def esc(s):
    return s.replace("'", "''")

def yid(url):
    m = re.search(r"(?:shorts/|watch\?v=)([A-Za-z0-9_-]{11})", url)
    return m.group(1) if m else None

lines = ["-- 주간 유튜브 쇼츠 시딩 배치 실행 — 자동 생성, 실행 전 검토 요망", "begin;"]

for p in plan:
    post_id = str(uuid.uuid4())
    vid = yid(p["video_url"])
    thumb = f"https://img.youtube.com/vi/{vid}/hqdefault.jpg"
    pt = p["post_time"]

    lines.append(f"""
insert into board_posts (id, user_id, nickname, category, content, images, created_at, updated_at)
values ('{post_id}', '{p['poster']['id']}', '{esc(p['poster']['nickname'])}', '{p['category']}',
  '{esc(p['content'])}', array['{thumb}'], '{pt}'::timestamptz, '{pt}'::timestamptz);""")

    like_values = ",\n  ".join(
        f"('{post_id}', '{l['id']}', least('{pt}'::timestamptz + interval '{l['delay_min']} minutes', now() - interval '1 minute'))"
        for l in p["likers"]
    )
    lines.append(f"""insert into board_likes (post_id, user_id, created_at) values
  {like_values};""")

    if p["commenters"]:
        comment_values = ",\n  ".join(
            f"('{post_id}'::uuid, '{c['id']}'::uuid, '{esc(c['nickname'])}', '{esc(c['text'])}', "
            f"least('{pt}'::timestamptz + interval '{c['delay_min']} minutes', now() - interval '1 minute'))"
            for c in p["commenters"]
        )
        lines.append(f"""insert into board_comments (post_id, user_id, nickname, content, created_at, updated_at)
select post_id, user_id, nickname, content, created_at, created_at from (values
  {comment_values}
) as v(post_id, user_id, nickname, content, created_at);""")

    # 팔로워(친구) 자동 추가 — 글쓴이를 이미 친구가 아닌 계정만 골라 즉시 accepted로 추가
    # (2026-09-30 대표님 지시: 5/7/10% 랜덤 비율). 양방향 중복 방지를 위해 NOT EXISTS로 확인.
    if p.get("new_followers"):
        follow_values = ",\n  ".join(
            f"('{f['id']}'::uuid, '{p['poster']['id']}'::uuid, "
            f"least('{pt}'::timestamptz + interval '{f['delay_min']} minutes', now() - interval '1 minute'))"
            for f in p["new_followers"]
        )
        lines.append(f"""insert into friendships (requester_id, addressee_id, status, created_at, responded_at)
select requester_id, addressee_id, 'accepted', created_at, created_at from (values
  {follow_values}
) as v(requester_id, addressee_id, created_at)
where not exists (
  select 1 from friendships f
  where (f.requester_id = v.requester_id and f.addressee_id = v.addressee_id)
     or (f.requester_id = v.addressee_id and f.addressee_id = v.requester_id)
)
on conflict (requester_id, addressee_id) do nothing;""")

lines.append("commit;")
sql = "\n".join(lines)
out = os.path.join(OUT_DIR, "week_batch.sql")
open(out, "w", encoding="utf-8").write(sql)
print("wrote", len(sql), "chars to", out, "| posts:", len(plan))
