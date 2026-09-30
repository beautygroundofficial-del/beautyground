import json, random, re, os, sys, time, urllib.request, urllib.error

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

# 일간 유튜브 쇼츠 시딩 배치 생성기 — 2026-09-29 시작(v2: 영상 제목에 맞는 캡션·댓글을 Gemini로 생성), 2026-09-30 매일 실행으로 전환
# 사용법: GEMINI_API_KEY=xxx python scripts/seed_gen_week_plan.py
#   (이 파일과 같은 폴더의 seed_content_pool.json/seed_accounts_cache.json을 읽음)
#   seed_accounts_cache.json이 오래됐으면 먼저 auth.users에서 bgseed%@beautyground.co.kr 재조회해 갱신할 것.
#   GEMINI_API_KEY가 없거나 호출 실패 시 정적 템플릿으로 자동 대체(자동화가 죽지 않게).
# 출력: scripts/seed_output/week_plan.json → seed_gen_week_sql.py로 SQL 생성 → db_query.mjs로 실행(대표님 승인 후).

random.seed()  # 실제 랜덤 — 매 실행마다 다르게

BASE = os.path.dirname(os.path.abspath(__file__))
pool = json.load(open(os.path.join(BASE, "seed_content_pool.json"), encoding="utf-8"))
accounts_raw = json.load(open(os.path.join(BASE, "seed_accounts_cache.json"), encoding="utf-8"))
accounts = [a for a in accounts_raw if a.get("nickname")]

GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-2.5-flash"


def yid(url):
    m = re.search(r"(?:shorts/|watch\?v=)([A-Za-z0-9_-]{11})", url)
    return m.group(1) if m else None


# 정적 템플릿 — Gemini 실패 시 대체용(비상용, 영상 제목과 무관하니 실전에서는 되도록 안 쓴다)
FALLBACK_CAPTIONS = {
    "mind": ["이 말씀 마음에 새기고 갑니다ㅠㅠ"], "spouse": ["공감 백만개..."], "parents": ["부모님 생각나서 눈물나네요"],
    "chat": ["이거 보고 빵터짐ㅋㅋㅋㅋ"], "menopause": ["저도 요즘 딱 이래서 도움됐어요"], "skin": ["괜찮은 정보네요 저장!"],
    "body": ["저도 이거 시작해봐야겠어요"], "living": ["저장해놓고 써야겠네요"], "eco": ["절약 꿀팁 감사해요"],
    "kids": ["육아 힘든데 위로되네요"],
}
FALLBACK_COMMENTS = ["완전 공감이요", "저도 그래요ㅠㅠ", "맞말이네요", "좋은 정보 감사해요", "저장해갑니다"]


CATEGORY_DESC = {
    "kids": "육아(아이 키우는 이야기)", "spouse": "부부(남편이랑 사는 이야기)", "parents": "부모님(부모님 생각나는 날)",
    "body": "건강(몸이 달라지는 이야기)", "menopause": "갱년기", "skin": "피부", "mind": "마음이 힘든 날(위로·인생조언)",
    "living": "살림하는 이야기", "eco": "아껴 쓰는 이야기(절약)", "chat": "그냥 하는 이야기(잡담·유머)",
}


def gemini_generate(video_title, category, n_comments):
    """영상 제목을 보고 그 내용에 맞는 캡션 1개 + 댓글 n개를 생성.
    제목만으로 판단해 그 카테고리 게시판과 안 맞으면 fits_category=false를 받아 이 영상은 쓰지 않는다
    (2026-09-30 — "담배 피우는 이유" 영상이 parents 카테고리에 잘못 들어간 사고로 추가).
    제목에 없는 내용을 지어내지 말라는 규칙도 명시(같은 날 living 카테고리에서 지어낸 사례 발견)."""
    if not GEMINI_KEY:
        return None
    cat_desc = CATEGORY_DESC.get(category, category)
    prompt = (
        f"유튜브 쇼츠 제목: \"{video_title}\"\n"
        f"이 영상을 뷰티그라운드 앱 커뮤니티 게시판 \"{cat_desc}\" 카테고리에 공유하려 합니다.\n"
        f"먼저 판단: 이 제목이 실제로 \"{cat_desc}\" 주제와 맞습니까? 전혀 안 맞으면(예: 카테고리는 부모님인데 "
        "제목은 흡연 얘기처럼 무관한 경우) fits_category를 false로 하고 나머지는 빈 값으로 두세요.\n"
        "맞으면(fits_category=true):\n"
        "1) 이 영상을 실제로 본 40~60대 여성이 쓸 법한, 제목에 나온 내용만 반영한 자연스러운 게시글 캡션 1개 "
        "— 제목에 없는 세부내용(효능·방법 등)을 지어내지 말 것, 제목 정보만으로 쓸 것\n"
        "2) 그 게시글에 다른 사람들이 남길 법한, 역시 이 영상 내용에 맞는 자연스러운 댓글 "
        f"{n_comments}개(서로 다른 말투·길이로)\n"
        "규칙: 존댓말 완결문 대신 반말·구어체 섞기, 이모티콘 남발 금지, 제목에 나온 구체적 내용을 최소 하나는 "
        "자연스럽게 언급할 것.\n"
        '다음 JSON 형식으로만 답하세요: {"fits_category": true/false, "caption": "...", "comments": ["...", ...]}'
    )
    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"response_mime_type": "application/json"},
    }).encode("utf-8")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_KEY}"
    # 무료 티어는 429(레이트리밋)·503(과부하)이 잦아 재시도 없이는 fallback으로 자주 떨어짐
    # (2026-09-30 테스트에서 10건 중 8건이 재시도 없이 fallback행 — 재시도 넣어 해결)
    last_err = None
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.load(resp)
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(text)
            if not parsed.get("fits_category", True):
                print(f"  [카테고리 불일치, 건너뜀] {video_title[:40]}", file=sys.stderr)
                return "mismatch"
            caption = parsed.get("caption", "").strip()
            comments = [c.strip() for c in parsed.get("comments", []) if c.strip()]
            if caption and comments:
                return {"caption": caption, "comments": comments}
            last_err = "빈 응답"
            break
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code in (429, 503) and attempt < 3:
                time.sleep(5 * (attempt + 1))
                continue
            break
        except Exception as e:
            last_err = e
            break
    print(f"  [gemini 실패, {attempt + 1}회 시도] {video_title[:30]}: {last_err}", file=sys.stderr)
    return None


# 카테고리별 영상 큐(순환용)
cat_videos = {}
for fig in pool["figures"]:
    default_cat = fig["board_category"]
    for v in fig["videos"]:
        cat = v.get("category_override", default_cat)
        cat_videos.setdefault(cat, []).append({"url": v["url"], "title": v["title"], "figure": fig["name"]})

CATEGORIES = ["kids", "spouse", "parents", "body", "menopause", "skin", "mind", "living", "eco", "chat"]

used_this_week = set()
plan = []
from datetime import datetime, timedelta, timezone
now = datetime.now(timezone.utc)

for cat_i, cat in enumerate(CATEGORIES):
    videos = cat_videos.get(cat)
    if not videos:
        continue
    if cat_i > 0:
        time.sleep(3)  # 무료 티어 분당 요청 제한 완화 — 카테고리마다 호출 간격 확보

    candidates = random.sample(videos, min(3, len(videos)))
    video = None
    gen = None
    n_likes = random.randint(10, 30)
    n_comments_target = max(1, int(n_likes * random.uniform(0.25, 0.45)))
    for cand in candidates:
        result = gemini_generate(cand["title"], cat, n_comments_target)
        if result == "mismatch":
            continue  # 카테고리와 안 맞는 영상 — 다음 후보로
        video, gen = cand, result
        break
    if video is None:
        print(f"[{cat}] 맞는 영상을 못 찾아 이번 주는 건너뜀(후보 {len(candidates)}개 전부 카테고리 불일치)", file=sys.stderr)
        continue

    vid = yid(video["url"])
    avail = [a for a in accounts if a["id"] not in used_this_week]
    poster = random.choice(avail)
    used_this_week.add(poster["id"])

    # 2026-09-30 매일 실행으로 전환 — 예전엔 게시물을 과거 0~6일에 무작위로 흩뿌렸으나(day_offset),
    # 매일 도는 지금은 그러면 "오늘 실행분"이 며칠 전 날짜로 찍혀 실행 여부를 못 알아보는 문제가
    # 생긴다(대표님이 실제로 이 문제로 "오늘 것 하나도 안 올라왔다"고 지적). 오늘 날짜로 고정.
    hour = random.randint(8, 22)
    minute = random.randint(0, 59)
    post_time = now.replace(hour=hour, minute=minute, second=random.randint(0, 59), microsecond=0)

    react_pool = [a for a in accounts if a["id"] != poster["id"]]
    likers = random.sample(react_pool, min(n_likes, len(react_pool)))
    commenters = random.sample(likers, min(n_comments_target, len(likers)))

    if gen:
        caption = gen["caption"]
        comment_pool = gen["comments"]
        source = "gemini"
    else:
        caption = random.choice(FALLBACK_CAPTIONS.get(cat, ["이거 보세요"]))
        comment_pool = FALLBACK_COMMENTS
        source = "fallback"
    # comments 개수가 모자라면 반복 사용, 넘치면 자름
    comment_texts = [comment_pool[i % len(comment_pool)] for i in range(len(commenters))]

    plan.append({
        "category": cat,
        "video_url": video["url"],
        "video_title": video["title"],
        "figure": video["figure"],
        "thumbnail": f"https://img.youtube.com/vi/{vid}/hqdefault.jpg",
        "poster": {"id": poster["id"], "nickname": poster["nickname"]},
        "content": f"{caption}\n{video['url']}",
        "content_source": source,
        "post_time": post_time.isoformat(),
        "likers": [{"id": a["id"], "delay_min": random.randint(5, 4000)} for a in likers],
        "commenters": [
            {"id": a["id"], "nickname": a["nickname"], "text": comment_texts[i], "delay_min": random.randint(5, 4000)}
            for i, a in enumerate(commenters)
        ],
    })

plan.sort(key=lambda p: p["post_time"])
out_dir = os.path.join(BASE, "seed_output")
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "week_plan.json")
json.dump(plan, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

print(f"posts={len(plan)}")
for p in plan:
    print(f"  [{p['category']}] ({p['content_source']}) {p['poster']['nickname']} -> {p['video_title'][:30]} | likes={len(p['likers'])} comments={len(p['commenters'])} at {p['post_time']}")
