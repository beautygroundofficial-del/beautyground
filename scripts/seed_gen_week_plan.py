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
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY")
CLAUDE_MODEL = "claude-haiku-4-5"


def claude_json(prompt):
    """Claude Haiku 1차 생성기(2026-10-09 전환 — Gemini 503/타임아웃으로 대체문구행이 4건 중 3건 발생).
    프롬프트를 Haiku에 보내 JSON dict를 받는다. 키가 없거나 실패하면 None → Gemini → 정적 템플릿 순으로 대체."""
    if not ANTHROPIC_KEY:
        return None
    body = json.dumps({
        "model": CLAUDE_MODEL, "max_tokens": 1024,
        "messages": [{"role": "user", "content": prompt}],
    }).encode("utf-8")
    for attempt in range(2):
        try:
            req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body, headers={
                "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                text = json.load(resp)["content"][0]["text"]
            m = re.search(r"\{.*\}", text, re.S)
            return json.loads(m.group(0)) if m else None
        except Exception as e:
            print(f"  [claude 실패, {attempt + 1}회 시도] {e}", file=sys.stderr)
            time.sleep(5)
    return None


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


def gemini_generate_original(category, n_comments):
    """영상 없이, 그 카테고리 주제로 자연스럽게 떠오른 생각을 쓰는 글 — 캡션 1개 + 댓글 n개.
    2026-09-30 대표님 지시: 쇼츠 링크만 계속 올라오면 부자연스럽다 — 텍스트만 쓰는 글도 섞어야 함."""
    if not GEMINI_KEY and not ANTHROPIC_KEY:
        return None
    cat_desc = CATEGORY_DESC.get(category, category)
    prompt = (
        f"뷰티그라운드 앱 커뮤니티 게시판 \"{cat_desc}\" 카테고리에, 영상이나 사진 없이 그냥 오늘 문득 든 생각을 "
        "짧게 적는 글을 씁니다(유튜브 링크 절대 포함하지 말 것).\n"
        f"1) 40~60대 여성이 \"{cat_desc}\" 주제로 오늘 느낀 일상적인 생각·감정을 짧게 쓴 캡션 1개 "
        "(구체적인 장면이나 상황 하나를 담을 것 — 추상적인 말만 늘어놓지 말 것)\n"
        f"2) 그 글에 다른 사람들이 남길 법한 자연스러운 댓글 {n_comments}개(서로 다른 말투·길이로)\n"
        "규칙: 존댓말 완결문 대신 반말·구어체 섞기, 이모티콘 남발 금지.\n"
        '다음 JSON 형식으로만 답하세요: {"caption": "...", "comments": ["...", ...]}'
    )
    parsed = claude_json(prompt)  # 2026-10-09 대표님 지시: 앞으로 Claude Haiku가 기본, Gemini는 Haiku 실패 시 대체
    if parsed:
        caption = str(parsed.get("caption", "")).strip()
        comments = [str(c).strip() for c in parsed.get("comments", []) if str(c).strip()]
        if caption and comments:
            return {"caption": caption, "comments": comments}
    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"response_mime_type": "application/json"},
    }).encode("utf-8")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_KEY}"
    last_err = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.load(resp)
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(text)
            caption = parsed.get("caption", "").strip()
            comments = [c.strip() for c in parsed.get("comments", []) if c.strip()]
            if caption and comments:
                return {"caption": caption, "comments": comments}
            last_err = "빈 응답"
            break
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code in (429, 503) and attempt < 2:
                wait = 20
                try:
                    err_body = json.loads(e.read().decode("utf-8"))
                    for d in err_body.get("error", {}).get("details", []):
                        if d.get("@type", "").endswith("RetryInfo"):
                            wait = max(20, float(d["retryDelay"].rstrip("s")) + 2)
                except Exception:
                    pass
                time.sleep(wait)
                continue
            break
        except Exception as e:
            last_err = e
            break
    print(f"  [gemini(텍스트형) 실패, {attempt + 1}회 시도] {category}: {last_err}", file=sys.stderr)
    return None


def gemini_generate(video_title, category, n_comments):
    """영상 제목을 보고 그 내용에 맞는 캡션 1개 + 댓글 n개를 생성.
    제목만으로 판단해 그 카테고리 게시판과 안 맞으면 fits_category=false를 받아 이 영상은 쓰지 않는다
    (2026-09-30 — "담배 피우는 이유" 영상이 parents 카테고리에 잘못 들어간 사고로 추가).
    제목에 없는 내용을 지어내지 말라는 규칙도 명시(같은 날 living 카테고리에서 지어낸 사례 발견)."""
    if not GEMINI_KEY and not ANTHROPIC_KEY:
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
    parsed = claude_json(prompt)  # Haiku 기본, 실패 시 아래 Gemini로 대체
    if parsed:
        if not parsed.get("fits_category", True):
            print(f"  [카테고리 불일치, 건너뜀] {video_title[:40]}", file=sys.stderr)
            return "mismatch"
        caption = str(parsed.get("caption", "")).strip()
        comments = [str(c).strip() for c in parsed.get("comments", []) if str(c).strip()]
        if caption and comments:
            return {"caption": caption, "comments": comments}
    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"response_mime_type": "application/json"},
    }).encode("utf-8")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_KEY}"
    # 무료 티어는 분당 요청 제한(RPM)이 낮아 429가 잦다. 2026-09-30 매일전환 첫날 실측: 고정
    # 5·10·15초 백오프로는 회복이 안 돼 10건 중 7건이 fallback행. 429 응답의 RetryInfo.retryDelay가
    # 종종 1~2초로 짧게 와도 그대로 믿지 말고 최소 20초는 기다린다(짧은 값은 개별 요청 재시도 권장값일
    # 뿐 분당 한도 자체의 회복 시간이 아닌 것으로 판단됨). 최대 3회만 시도(무한 대기 방지).
    last_err = None
    for attempt in range(3):
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
            if e.code in (429, 503) and attempt < 2:
                wait = 20
                try:
                    err_body = json.loads(e.read().decode("utf-8"))
                    for d in err_body.get("error", {}).get("details", []):
                        if d.get("@type", "").endswith("RetryInfo"):
                            wait = max(20, float(d["retryDelay"].rstrip("s")) + 2)
                except Exception:
                    pass
                print(f"  [gemini {e.code}, {wait:.0f}초 대기 후 재시도] {video_title[:30]}", file=sys.stderr)
                time.sleep(wait)
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

# ===== 자연스러운 게시 규칙 (2026-09-30 확정, 대표님 지시 — 임의 조정 전 이 블록부터 고칠 것) =====
# 1) 하루 게시물 개수는 항상 같지 않다 — 6~10개 사이에서 매일 랜덤(10개 카테고리 전부가 매일
#    올라오면 기계적으로 보인다).
# 2) 형식(텍스트/쇼츠/이미지)은 확률이 아니라 그날 개수만큼 비율대로 미리 채워 섞은 뒤 배정한다
#    (독립 확률이면 운 나쁜 날 한 형식만 몰릴 수 있음). 텍스트가 가장 많고, 쇼츠가 주류로 보이지
#    않게 한다.
# 3) 같은 날 배치 안에서 같은 계정이 두 번 글을 쓰지 않는다(used_this_week로 보장).
# 4) 게시 시각은 하루 8~22시 사이에 흩어놓는다(한꺼번에 몰아 올리지 않음).
POST_TYPES = ["text", "shorts", "image"]
POST_TYPE_WEIGHTS = [0.4, 0.3, 0.3]
MIN_POSTS_PER_DAY = 2
MAX_POSTS_PER_DAY = 4
# 2026-10-04 정정: 바로 위 복귀 조치는 잘못된 판단이었음 — Gmail만 검색하고 옵시디언(앱 스토어 등록.md)을
# 확인하지 않아, 애플·구글 둘 다 2026-09-28에 이미 심사 제출(iOS appStoreState=READY_FOR_REVIEW,
# Google Play "검토 중인 변경사항")까지 끝나있던 것을 놓쳤다. 10-01 축소 조치가 맞았으므로 원복.
# 앞으로 "심사 제출 여부"를 판단할 땐 Gmail 검색만으로 결론 내리지 말고 옵시디언 03 홈페이지/앱 스토어 등록.md부터 볼 것.
# 이미지형 글의 사진 — CC0(Open Peeps, dicebear.com이 무료 호스팅) 재확인된 라이선스라 재검토 불필요.
DICEBEAR_STYLE = "open-peeps"


def dicebear_url(seed):
    return f"https://api.dicebear.com/9.x/{DICEBEAR_STYLE}/png?seed={seed}&backgroundColor=f3f0ea,e8e2d5,fbeee0"


n_total = random.randint(MIN_POSTS_PER_DAY, MAX_POSTS_PER_DAY)
today_categories = random.sample(CATEGORIES, n_total)  # 카테고리 전부가 아니라 오늘은 이 중 일부만

day_types = []
for t, w in zip(POST_TYPES, POST_TYPE_WEIGHTS):
    day_types += [t] * round(n_total * w)
while len(day_types) < n_total:
    day_types.append("text")
day_types = day_types[:n_total]
random.shuffle(day_types)

for cat_i, cat in enumerate(today_categories):
    if cat_i > 0:
        time.sleep(8)  # 분당 요청 제한 완화 — 카테고리 첫 호출부터 넉넉히 간격 확보(2026-09-30, 3초→8초)

    post_type = day_types[cat_i]
    videos = cat_videos.get(cat)
    if post_type == "shorts" and not videos:
        post_type = "text"  # 이 카테고리에 영상이 없으면 텍스트형으로 대체

    video = None
    gen = None
    n_likes = random.randint(4, 12)  # 2026-10-04 정정: 심사 제출 이미 돼있었음(위 설명 참고), 축소 원복
    n_comments_target = max(1, int(n_likes * random.uniform(0.25, 0.45)))

    if post_type == "shorts":
        candidates = random.sample(videos, min(2, len(videos)))  # 호출량 축소(2026-09-30, 3→2)
        for cand in candidates:
            result = gemini_generate(cand["title"], cat, n_comments_target)
            if result == "mismatch":
                continue  # 카테고리와 안 맞는 영상 — 다음 후보로
            video, gen = cand, result
            break
        if video is None:
            print(f"[{cat}] 맞는 영상을 못 찾아 텍스트형으로 대체(후보 {len(candidates)}개 전부 카테고리 불일치)", file=sys.stderr)
            post_type = "text"

    if post_type in ("text", "image"):
        gen = gemini_generate_original(cat, n_comments_target)

    vid = yid(video["url"]) if video else None
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

    # 팔로워(친구) 자동 추가 — 2026-09-30 대표님 지시: 매일 글을 쓰니 그때마다 다른 계정들이
    # 글쓴이를 친구로 추가하게 하자. 전원 똑같이 10%면 티가 나니, 5%/7%/10% 중 매번 랜덤으로
    # 하나 골라 그 비율만큼만 추가(자연스러운 편차를 위함).
    # 2026-10-04 정정: 심사 제출 이미 돼있었음(위 설명 참고) — 축소 비율로 원복.
    follow_rate = random.choice([0.02, 0.03, 0.05])
    n_followers = round(len(react_pool) * follow_rate)
    followers = random.sample(react_pool, min(n_followers, len(react_pool)))

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

    if post_type == "shorts":
        image_url = f"https://img.youtube.com/vi/{vid}/hqdefault.jpg"
        content = f"{caption}\n{video['url']}"
    elif post_type == "image":
        image_url = dicebear_url(f"{poster['id']}-{post_time.isoformat()}")
        content = caption
    else:  # text
        image_url = None
        content = caption

    plan.append({
        "category": cat,
        "post_type": post_type,
        "video_url": video["url"] if video else None,
        "video_title": video["title"] if video else None,
        "figure": video["figure"] if video else None,
        "thumbnail": image_url,
        "poster": {"id": poster["id"], "nickname": poster["nickname"]},
        "content": content,
        "content_source": source,
        "post_time": post_time.isoformat(),
        "likers": [{"id": a["id"], "delay_min": random.randint(5, 4000)} for a in likers],
        "commenters": [
            {"id": a["id"], "nickname": a["nickname"], "text": comment_texts[i], "delay_min": random.randint(5, 4000)}
            for i, a in enumerate(commenters)
        ],
        "new_followers": [{"id": a["id"], "delay_min": random.randint(5, 4000)} for a in followers],
        "follow_rate": follow_rate,
    })

plan.sort(key=lambda p: p["post_time"])
out_dir = os.path.join(BASE, "seed_output")
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "week_plan.json")
json.dump(plan, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

print(f"posts={len(plan)}")
for p in plan:
    label = p["video_title"][:30] if p["video_title"] else p["content"][:30]
    print(f"  [{p['category']}] ({p['post_type']}/{p['content_source']}) {p['poster']['nickname']} -> {label} | likes={len(p['likers'])} comments={len(p['commenters'])} followers=+{len(p['new_followers'])}({p['follow_rate']*100:.0f}%) at {p['post_time']}")
