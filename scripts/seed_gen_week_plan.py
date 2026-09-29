import json, random, re, os
from datetime import datetime, timedelta, timezone

# 주간 유튜브 쇼츠 시딩 배치 생성기 — 2026-09-29
# 사용법: python scripts/seed_gen_week_plan.py  (이 파일과 같은 폴더의 seed_content_pool.json/seed_accounts_cache.json을 읽음)
#   seed_accounts_cache.json이 오래됐으면 먼저 auth.users에서 bgseed%@beautyground.co.kr 재조회해 갱신할 것.
# 출력: scripts/seed_output/week_plan.json → seed_gen_week_sql.py로 SQL 생성 → db_query.mjs로 실행(대표님 승인 후).

random.seed()  # 실제 랜덤 — 매 실행마다 다르게

BASE = os.path.dirname(os.path.abspath(__file__))
pool = json.load(open(os.path.join(BASE, "seed_content_pool.json"), encoding="utf-8"))
accounts_raw = json.load(open(os.path.join(BASE, "seed_accounts_cache.json"), encoding="utf-8"))
accounts = [a for a in accounts_raw if a.get("nickname")]

def yid(url):
    m = re.search(r"(?:shorts/|watch\?v=)([A-Za-z0-9_-]{11})", url)
    return m.group(1) if m else None

# 카테고리별 영상 큐(순환용)
cat_videos = {}
for fig in pool["figures"]:
    default_cat = fig["board_category"]
    for v in fig["videos"]:
        cat = v.get("category_override", default_cat)
        cat_videos.setdefault(cat, []).append({"url": v["url"], "title": v["title"], "figure": fig["name"]})

CATEGORIES = ["kids", "spouse", "parents", "body", "menopause", "skin", "mind", "living", "eco", "chat"]

CAPTIONS = {
    "mind": ["이거 보다가 진짜 울컥하네요...", "요즘 마음이 힘들었는데 위로받고 갑니다", "이 말씀 마음에 새기고 갑니다ㅠㅠ"],
    "spouse": ["이거 보고 남편한테 좀 배우라 그래야겠어요", "결혼생활 힘들 때마다 이런거 찾아보게 되네요", "공감 백만개..."],
    "parents": ["부모님 생각나서 눈물나네요", "이거 보고 엄마한테 전화했어요", "부모님 생각하며 봤습니다"],
    "chat": ["이거 완전 웃기다 ㅋㅋㅋ", "오늘 하루 이거 보고 웃었네요", "이거 보고 빵터짐ㅋㅋㅋㅋ"],
    "menopause": ["저도 요즘 딱 이래서 도움됐어요", "이런 정보 진짜 필요했는데", "저장해놓고 자주 봐야겠어요"],
    "skin": ["요즘 피부 고민이었는데 참고할게요", "이 방법 저도 해봐야겠다", "괜찮은 정보네요 저장!"],
    "body": ["운동해야겠다 싶네요", "이거 보고 자극받았어요", "저도 이거 시작해봐야겠어요"],
    "living": ["이런 꿀팁 좋아요", "당장 써먹어야겠어요", "저장해놓고 써야겠네요"],
    "eco": ["이거 진짜 유용하네요", "이번달부터 해봐야겠어요", "절약 꿀팁 감사해요"],
    "kids": ["애 키우면서 공감되는게 많네요", "우리 아이도 저랬는데", "육아 힘든데 위로되네요"],
}

REACTION_COMMENTS = [
    "완전 공감이요", "저도 그래요ㅠㅠ", "맞말이네요", "좋은 정보 감사해요", "저장해갑니다",
    "저도 딱 이 생각했어요", "와 진짜 그러네요", "고민이었는데 도움됐어요", "공감하고 갑니다", "좋네요 ㅎㅎ",
    "이거 저도 해봐야겠어요", "말씀 감사합니다", "마음에 와닿네요", "저만 그런게 아니었네요", "따뜻하네요",
]

used_this_week = set()
plan = []
now = datetime.now(timezone.utc)

for cat in CATEGORIES:
    videos = cat_videos.get(cat)
    if not videos:
        continue
    video = random.choice(videos)
    vid = yid(video["url"])
    avail = [a for a in accounts if a["id"] not in used_this_week]
    poster = random.choice(avail)
    used_this_week.add(poster["id"])

    day_offset = random.randint(0, 6)
    hour = random.randint(8, 22)
    minute = random.randint(0, 59)
    post_time = (now - timedelta(days=day_offset)).replace(hour=hour, minute=minute, second=random.randint(0,59), microsecond=0)

    react_pool = [a for a in accounts if a["id"] != poster["id"]]
    n_likes = random.randint(10, 30)
    likers = random.sample(react_pool, min(n_likes, len(react_pool)))
    n_comments = max(1, int(n_likes * random.uniform(0.25, 0.45)))
    commenters = random.sample(likers, min(n_comments, len(likers)))

    plan.append({
        "category": cat,
        "video_url": video["url"],
        "video_title": video["title"],
        "figure": video["figure"],
        "thumbnail": f"https://img.youtube.com/vi/{vid}/hqdefault.jpg",
        "poster": {"id": poster["id"], "nickname": poster["nickname"]},
        "content": f"{random.choice(CAPTIONS.get(cat, ['이거 보세요']))}\n{video['url']}",
        "post_time": post_time.isoformat(),
        "likers": [{"id": a["id"], "delay_min": random.randint(5, 4000)} for a in likers],
        "commenters": [{"id": a["id"], "nickname": a["nickname"], "text": random.choice(REACTION_COMMENTS), "delay_min": random.randint(5, 4000)} for a in commenters],
    })

plan.sort(key=lambda p: p["post_time"])
out_dir = os.path.join(BASE, "seed_output")
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "week_plan.json")
json.dump(plan, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

print(f"posts={len(plan)}")
for p in plan:
    print(f"  [{p['category']}] {p['poster']['nickname']} -> {p['video_title'][:30]} | likes={len(p['likers'])} comments={len(p['commenters'])} at {p['post_time']}")
