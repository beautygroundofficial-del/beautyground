## 세션 분리 규칙 — 커뮤니티 세션 vs 셀러센터 세션 (2026-09-11 대표님 확정)

같은 저장소에서 두 세션이 동시에 일한다. 서로 덮어쓰지 않도록 아래를 지킨다.

- **셀러센터(브랜드가 들어와 제품 업데이트 등) 작업**은 `feature/seller-admin`에서 가지 친 **`feature/seller-center` 브랜치**를 **`C:\Temp\bg-seller` 작업트리**에서 진행한다. `Desktop\beautyground-mall`(커뮤니티 세션 폴더)에서는 셀러센터 파일을 편집하지 않는다.
- **커뮤니티 작업**은 `feature/seller-admin`을 `Desktop\beautyground-mall`에서 진행한다. 개발 서버는 5199(커뮤니티)·5173/5174(main 작업트리 `C:\Temp\bg-main`) — 남의 포트를 죽이지 않는다.
- **시작 시 `hermes_worklock` 등록**(scope=beautyground-mall, branch, title, machine), 마무리 시 `status=done`.
- **`api/*.ts` 새 파일 금지** — Vercel 서버리스 함수 12/12 한도. 기존 파일에 `action`/`mode` 분기로 얹는다(안 그러면 배포가 조용히 실패).
- **`src/App.tsx`·`src/components/admin/AdminLayout.tsx` 수정은 작업 마지막에 한 번**(두 세션이 모두 라우트·메뉴를 추가하는 파일이라 충돌 지점).
- **셀러 세션은 커뮤니티 테이블·함수를 건드리지 않는다** — `diaries`·`diary_*`·`board_*`·`daily_answers`·`answer_*`·`friendships`·`news_seen`·`reactions`·`get_my_news` 등. 공유 함수 `is_admin()`·`claim_mission`은 어느 세션도 다시 만들지 않는다.
- **운영 DB SQL은 내용 보고 → 대표님 승인 → 실행** 순서(2026-09-11 확정).
- push 전 `git pull --rebase`. 셀러센터가 끝나면 커뮤니티 세션이 `feature/seller-center`를 `feature/seller-admin`에 합친다. main 반영은 대표님 결정.

## 유저 화면은 모바일 전용, PC 레이아웃은 관리자·브랜드 입점사만 (2026-09-12 대표님 확정)

- 손님이 보는 모든 화면(`/app/*`, 커뮤니티·쇼핑·마이페이지·로그인)은 **PC에서도 항상 모바일 레이아웃(480px 프레임)** — `src/lib/viewMode.ts`의 `USER_PAGES_MOBILE_ONLY = true`. 새 유저 화면에 `Desktop*.tsx` 짝을 만들지 않는다(기존 Desktop* 파일은 지우지 말고 그대로 둔다 — 삭제는 보고 후).
- PC 레이아웃을 쓰는 곳은 **관리자(`/admin`)·브랜드 입점사(`/brand`, 셀러센터)·호스트·백화점 포털**뿐.
- 예정(로드맵): 앱 등록·애플/안드로이드 연결이 끝나면 유저는 **PC 웹 접근을 막고 앱 다운로드로만** 쓰게 한다. 그 전까지 웹 모바일 화면 유지.

## 앱(Capacitor) 프로젝트 — `android/`·`ios/`·`capacitor.config.ts` (2026-09-12)

- 스토어 등록용 앱 껍데기. **웹(beautyground.co.kr)을 그대로 앱에 띄운다**(`server.url`) — 웹 화면 코드는 그대로, 앱 전용 화면을 따로 만들지 않는다. 걸음 수·푸시 등 네이티브 기능만 플러그인으로.
- `npx cap sync` 로 설정을 네이티브 프로젝트에 반영. 아이콘·스플래시는 `assets/` 원본에서 `npx capacitor-assets generate`.
- 이 PC엔 Java·Android SDK가 없어 빌드는 아직 불가(Android Studio 설치 필요), iOS 빌드는 Mac 필요. 상세·진행: 옵시디언 `03 홈페이지/앱 스토어 등록.md`.
- 셀러센터·커뮤니티 세션 모두 `android/`·`ios/` 안 파일은 손대지 않는다(앱 등록 담당 세션만).

## 클라우드 세션(브라우저·대시보드 로그인 없는 곳)에서 DB·검증하는 법 (2026-09-11)

Playwright 브라우저나 Supabase 대시보드 로그인이 없어도 아래 두 스크립트로 같은 일을 한다. 환경변수 4개가 세션에 있어야 한다: `SUPABASE_MGMT_TOKEN`(sbp_… 스코프 토큰: beautyground-main 1개·Database Read-write만·2026-12-10 만료), `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, 그리고 테스트 계정(`test3@test.com` / `test1234` — 구매자 역할).

- **운영 SQL 실행**: `node scripts/db_query.mjs supabase/xxx.sql` 또는 `--sql "select …"`. **반드시 내용 보고 → 대표님 승인 → 실행.** 승인 전엔 `select`만.
- **화면 로직 검증(브라우저 대신)**: `node scripts/rpc_as.mjs <email> <pw> rpc <함수> '<json>'` — 테스트 계정으로 로그인해 RPC를 직접 부른다. 비로그인은 `anon`. 쓰기 RPC(글·하트·댓글)를 불렀으면 끝나고 되돌린다.
- **화면 확인**: 브랜치를 push하면 Vercel 프리뷰 배포 주소가 생긴다 — 거기서 본다. 로컬 dev 서버는 없다.
- 두 계정 동시 실사용 검증(관리자+구매자 브라우저)·Storage 업로드 검증은 사무실 PC 세션(커뮤니티 세션)에 넘긴다.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
