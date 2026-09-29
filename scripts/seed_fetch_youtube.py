import json, os, re, sys, urllib.request, urllib.parse

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

# 커뮤니티 시딩용 유튜브 쇼츠 신규 링크 자동 수집 — 2026-09-29
# 카테고리별 영상 수가 MIN_PER_CATEGORY 미만이면 검색 쿼리로 보강한다.
# 사용법: YOUTUBE_DATA_API_KEY=xxx python scripts/seed_fetch_youtube.py

BASE = os.path.dirname(os.path.abspath(__file__))
POOL_PATH = os.path.join(BASE, "seed_content_pool.json")
API_KEY = os.environ.get("YOUTUBE_DATA_API_KEY")
if not API_KEY:
    print("YOUTUBE_DATA_API_KEY 환경변수가 없습니다", file=sys.stderr)
    sys.exit(2)

MIN_PER_CATEGORY = 8
MAX_FETCH_PER_QUERY = 6

# 카테고리별 검색 쿼리 — 실명 유명인 대신 무명 정보성 채널 위주(초상권 낮음).
# 필요하면 이름 있는 인물 쿼리를 추가해도 되지만, 그 경우 별도 검토 후 사람이 직접 seed_content_pool.json에 추가할 것.
QUERIES = {
    "kids": ["육아 꿀팁 쇼츠", "육아 공감 브이로그 쇼츠"],
    "spouse": ["부부 관계 조언 쇼츠", "결혼생활 공감 쇼츠"],
    "parents": ["부모님 감동 쇼츠", "효도 공감 쇼츠"],
    "body": ["건강 운동 습관 쇼츠", "50대 건강 정보 쇼츠"],
    "menopause": ["갱년기 극복 쇼츠", "갱년기 건강정보 쇼츠"],
    "skin": ["피부관리 꿀팁 쇼츠", "40대 스킨케어 쇼츠"],
    "mind": ["인생 명언 위로 쇼츠", "마음 다스리기 쇼츠"],
    "living": ["살림 꿀팁 쇼츠", "생활 정보 쇼츠"],
    "eco": ["절약 짠테크 쇼츠", "생활비 절약 쇼츠"],
    "chat": ["웃긴 영상 쇼츠", "공감 유머 쇼츠"],
}


def yt_search(query, max_results=6):
    params = {
        "part": "snippet", "q": query, "type": "video",
        "videoDuration": "short", "maxResults": max_results,
        "relevanceLanguage": "ko", "regionCode": "KR", "key": API_KEY,
    }
    url = "https://www.googleapis.com/youtube/v3/search?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=20) as resp:
        data = json.load(resp)
    out = []
    for item in data.get("items", []):
        vid = item["id"].get("videoId")
        title = item["snippet"]["title"]
        if vid:
            out.append({"url": f"https://www.youtube.com/shorts/{vid}", "title": title})
    return out


def main():
    pool = json.load(open(POOL_PATH, encoding="utf-8"))
    existing_urls = set()
    cat_counts = {}
    for fig in pool["figures"]:
        default_cat = fig["board_category"]
        for v in fig["videos"]:
            existing_urls.add(v["url"])
            cat = v.get("category_override", default_cat)
            cat_counts[cat] = cat_counts.get(cat, 0) + 1

    added_total = 0
    for cat, queries in QUERIES.items():
        have = cat_counts.get(cat, 0)
        if have >= MIN_PER_CATEGORY:
            print(f"[{cat}] 이미 {have}개 — 건너뜀")
            continue
        need = MIN_PER_CATEGORY - have
        collected = []
        for q in queries:
            if len(collected) >= need:
                break
            try:
                results = yt_search(q, MAX_FETCH_PER_QUERY)
            except Exception as e:
                print(f"[{cat}] 검색 실패({q}): {e}", file=sys.stderr)
                continue
            for r in results:
                if r["url"] in existing_urls:
                    continue
                collected.append(r)
                existing_urls.add(r["url"])
                if len(collected) >= need:
                    break
        if collected:
            pool["figures"].append({
                "name": f"{cat} 자동수집(무명채널)",
                "note": "GitHub Actions 자동 수집 — 게시 전 실제 재생 확인 권장",
                "board_category": cat,
                "videos": collected,
            })
            added_total += len(collected)
            print(f"[{cat}] {len(collected)}개 추가")

    if added_total:
        json.dump(pool, open(POOL_PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"총 {added_total}개 신규 링크 추가")


if __name__ == "__main__":
    main()
