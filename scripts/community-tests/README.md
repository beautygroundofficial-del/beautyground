# 커뮤니티 SQL·브라우저 격리 회귀 검증

운영 DB에 연결하지 않고 메모리의 PGlite에서 실제 SQL 함수를 실행한다. 일기 답글의 소식 누락을 기존 함수로 재현한 뒤, 저장소의 아래 두 SQL을 수정 없이 적용하여 검증한다.

- `supabase/community_conversation_integration.sql`
- `supabase/community_friend_request_lock.sql`

## 실행

Node.js와 npm을 사용한다. PGlite는 프로젝트 밖 임시 폴더에 설치하며 저장소의 `package.json`·잠금 파일은 바꾸지 않는다. 최초 검증 런타임은 `@electric-sql/pglite` **0.5.8**이다. 정확히 같은 버전으로 재현하려면 아래 설치 명령의 패키지 끝에 `@0.5.8`을 붙인다.

PowerShell에서 저장소 루트 기준:

```powershell
$communityRuntime = Join-Path ([System.IO.Path]::GetTempPath()) 'bg-community-test-runtime'
npm install --prefix $communityRuntime --no-save --ignore-scripts @electric-sql/pglite
$env:COMMUNITY_TEST_RUNTIME = $communityRuntime
node scripts/community-tests/test-community-sql.mjs
```

bash에서 저장소 루트 기준:

```bash
community_runtime="$(mktemp -d)"
npm install --prefix "$community_runtime" --no-save --ignore-scripts @electric-sql/pglite
COMMUNITY_TEST_RUNTIME="$community_runtime" node scripts/community-tests/test-community-sql.mjs
```

`COMMUNITY_TEST_RUNTIME`은 `node_modules`가 들어 있는 npm 설치 루트다. 변수를 생략하면 Node의 기본 패키지 탐색으로 `@electric-sql/pglite`를 동적 import한다. 실행 중 npm 설치나 운영 통신은 하지 않는다. 각 시나리오는 새 메모리 DB를 만들고 닫는다. `9/9` 통과 시 종료 코드 0, 하나라도 실패하면 1이다.

실행하는 현재 디렉터리가 달라도 소스·fixture는 `import.meta.url` 기준으로 찾는다. 다른 소스 사본을 점검할 때만 `COMMUNITY_TEST_REPO`에 저장소 경로, 다른 함수 스냅샷을 쓸 때만 `COMMUNITY_TEST_LIVE_DEFS`에 JSON 경로를 지정할 수 있다. 모두 로컬 파일 경로이며 DB 연결 문자열은 받지 않는다.

## 검증하는 9개 시나리오

1. 수정 전 함수에서 A의 글 → B의 댓글 → A의 답글이 B의 소식에 없는 기존 오류 재현.
2. 수정 후 B에게 `diary_reply`, 정확한 원글·댓글 ID 전달 및 기존 `get_my_news` 반환 형식 유지.
3. 제3자 답글을 원글·부모 댓글 작성자에게 각각 전달하고 같은 수신자는 중복 제거.
4. 숨김 일기·숨김 부모 댓글을 댓글 목록·소식·댓글 수에서 제외.
5. 최신 목록 밖 오래된 일기를 ID로 조회하고 과거 공개 질문의 답변에 접근. 숨김 답변·미공개 질문 차단.
6. 게시판·질문 답변 댓글의 정확한 ID, 익명 글에서 사용자 프로필 링크를 드러내지 않는 반환값, 원글 공개 상태 확인.
7. 읽음 워터마크 이후 도착한 소식 보존, 과거 시점으로 역행 금지, 미래 시점은 현재로 제한, null 처리.
8. `SET LOCAL ROLE anon/authenticated`와 사용자 claim으로 공개 읽기·로그인 전용 RPC 실행 권한 확인.
9. 친구 신청·받은 신청·수락 소식·취소·거절·자기 자신·없는 계정, 순차적으로 들어온 반대 방향 신청 확인.

## fixture와 재사용

- `fixtures/live-function-defs-20260927.json`: 2026-09-27에 읽기 전용으로 확인한 18개 기존 함수의 정의·이름·인수·반환 형식. 실제 회원·게시물 행, 계정 비밀번호, 서비스 URL, 키는 포함하지 않는다. 저장 당시 SHA-256: `c7846e85618822f9d75bac6ca9f2ec9d8819a686db6ed05741180164834283d4`.
- `community-db-harness.mjs`: 최소 테이블·가상 A/B/C 사용자·글을 만들고 기존 함수와 변경 SQL을 적용한다. `are_friends`·`display_name_of`는 저장소 `supabase/friends.sql`의 완전한 함수 정의를 읽는다.
- `test-community-sql.mjs`: 9개 독립 시나리오와 결과 출력.
- `load-pglite.mjs`: 외부 임시 설치 또는 기본 Node 탐색에서 런타임을 불러온다.
- `community-ui-server.mjs`: 같은 메모리 DB에 HTTP 요청을 연결하는 loopback 전용 서버. 추가 조회 함수는 저장소 `supabase/people.sql`, `friends.sql`, `community_media_edit.sql`에서 읽는다.
- `test-community-ui.py`: 별도 Chromium 프로세스의 가상 A/B 사용자가 앱 화면을 조작하는 16개 시나리오.

다른 로컬 테스트에서 다음처럼 재사용한다. `queryAs`는 역할·claim·쿼리를 같은 트랜잭션으로 묶고 호출 순서를 직렬화한다. 이 직렬화는 테스트 계정 구분을 위한 것이며 운영 DB 경합 테스트를 대체하지 않는다.

```javascript
import { createCommunityDb, IDS } from './community-db-harness.mjs'

const fixture = await createCommunityDb()
try {
  const result = await fixture.queryAs(IDS.A,
    'select * from public.get_community_news($1)', [50])
  console.log(result.rows)
} finally {
  await fixture.db.close()
}
```

기존 오류만 재현할 때는 `createCommunityDb({ applyNew: false })`를 사용한다. 일반 회귀 실행은 두 변경 SQL을 모두 필수로 읽는다.

## 브라우저 실행

저장소 루트에서 실행한다. 위의 PGlite 임시 설치를 먼저 완료한다. 기존 앱 서버가 없을 때만 첫 번째 터미널에서 `npm run dev -- --host 127.0.0.1 --port 5199 --strictPort`를 실행한다. 사용 중인 포트의 서버를 중단하지 않는다.

두 번째 PowerShell 터미널에서 로컬 fixture 서버를 실행한다. 시작할 때 출력하는 `sourceReaders`는 실제로 불러온 저장소 함수, `GET /health`의 `usedFallbacks`는 빈 응답으로 대체한 보조 데이터다.

```powershell
$env:COMMUNITY_TEST_RUNTIME = Join-Path ([System.IO.Path]::GetTempPath()) 'bg-community-test-runtime'
$env:PORT = '5201'
node scripts/community-tests/community-ui-server.mjs
```

세 번째 터미널에서 Python 3.9 이상 및 Playwright 1.48 이상을 사용한다. 아래는 패키지도 임시 가상환경에 설치하는 예다. 최초 패키지·브라우저 설치에는 인터넷 연결이 필요하다.

```powershell
$communityPython = Join-Path ([System.IO.Path]::GetTempPath()) 'bg-community-ui-python'
python -m venv $communityPython
$communityPythonExe = Join-Path $communityPython 'Scripts/python.exe'
& $communityPythonExe -m pip install 'playwright>=1.48'
& $communityPythonExe -m playwright install chromium
$env:APP = 'http://127.0.0.1:5199'
$env:PORT = '5201'
& $communityPythonExe scripts/community-tests/test-community-ui.py
```

`APP`은 앱의 loopback HTTP(S) 주소만 받으며 기본값은 `http://127.0.0.1:5199`다. 로컬 production preview도 지정할 수 있다. `PORT`는 bridge 서버와 Python 양쪽에서 동일하게 지정한다(기본 5201). `TEST_OUTPUT`을 지정하면 해당 폴더에 결과 JSON·화면 캡처를 저장하고, 생략하면 `tempfile.mkdtemp()`로 만든 폴더를 사용해 경로를 출력한다. 실행할 때마다 fixture DB를 초기화하므로 다른 테스트와 bridge를 동시에 사용하지 않는다.

브라우저 검증에는 댓글 → 상대방 소식 → 정확한 글·답글 복귀, 친구 신청·수락·취소·끊기, 과거 질문 답변, 익명 게시판, 초안 보존과 계정 분리, 앱/브라우저 뒤로 가기, 조회·전송·프로필 오류의 재시도, 50개 이후 댓글, 모두 읽음 이후 새 소식, 320/390/480/1440px 화면 폭이 포함된다. 이 스크립트는 실패 시 0이 아닌 종료 코드를 반환한다.

**브라우저의 운영 Supabase HTTP 요청은 전부 가로채 로컬 bridge 또는 명시적 가상 응답으로 처리한다.** 허용하는 외부 전달은 없으며 앱의 정확한 loopback origin만 통과시킨다. 서비스 워커는 차단하고 모든 WebSocket은 연결 없이 닫는다. 세션은 `invalid.example` 계정과 유효하지 않은 가상 JWT이며 실제 로그인·운영 계정·비밀키를 사용하지 않는다. 이 차단은 테스트가 생성한 브라우저에 적용된다. 테스트용 앱 서버의 `/api/`도 빈 응답으로 대체하므로 별도 서버측 외부 통신 경로를 검증하는 도구는 아니다.

## 2026-09-28 추가 회귀

글쓰기·홈·계정 전환 검사는 운영 방식의 **로컬 production preview**에서 실행한다. Vite 개발 서버의 HMR WebSocket과 테스트의 전면 WebSocket 차단이 충돌해 탐색이 지연되는 현상을 확인했다. 빌드한 앱을 `npm run preview -- --host 127.0.0.1 --port 5210 --strictPort`로 띄우고 아래처럼 실행한다. 기존 서버의 포트를 빼앗지 않는다.

```powershell
$env:APP = 'http://127.0.0.1:5210'
$env:PORT = '5209' # 별도로 실행한 메모리 bridge의 포트
python -B scripts/community-tests/test-community-feed.py
python -B scripts/community-tests/test-community-writing.py
node scripts/community-tests/test-app-news.cjs
node scripts/community-tests/test-writer-auth-race.cjs
node scripts/community-tests/test-community-update-results.cjs
```

- `test-community-feed.py`: 홈 조회 오류·재시도·정상 빈 목록·글 이동·반복 정렬·영상 이동 분리. 모든 외부 요청은 fixture에서 끝나며 bridge도 쓰지 않는다.
- `test-community-writing.py`: 계정별 초안, 이전 공용 초안 제외, 사진 일부 실패와 이미지 처리 예외 후 재시도, 로그인 후 수정 대상 복귀, 선택 항목 펼침, 입력 크기·버튼·네 가지 화면 너비. 가짜 Auth·Storage·게시 응답을 사용한다. 허용한 보조 조회만 loopback bridge로 보낸다.
- 세 `.cjs` 검사는 실제 TS/TSX 소스를 메모리에서 변환해 소식 계정 경합, 초기 인증과 초안 로드 경합, 수정된 행 확인을 검사한다. TypeScript는 프로젝트의 설치 패키지를 사용하고 운영 네트워크에 연결하지 않는다. `COMMUNITY_TEST_REPO`로 별도 소스 사본을 지정할 수 있다.

글쓰기 검사는 계정 소유자를 알 수 없는 이전 `bg_draft_diary`·`bg_draft_board` 값을 자동 복원하지 않으며 삭제하지도 않는 동작을 확인한다. 사진 업로드 fixture 성공은 실제 Storage 업로드 검증이 아니다.

## 공통 한계

- 최소 fixture 스키마이며 **운영 스키마 전체, 운영 RLS 정책 전체, Supabase Auth·Storage를 재현하지 않는다.** 공개 RPC의 실행 권한과 함수 내부 처리를 확인하는 테스트다.
- `auth.uid()`는 세션 claim으로 흉내 내고 `is_admin()`은 false로 고정한다. **`claim_mission`은 항상 0점을 반환하는 stub**이므로 포인트 적립·중복 지급·한도는 검증하지 않는다.
- **단일 PGlite 연결이므로 실제 두 DB 세션의 동시 요청·advisory lock 경합은 미검증이다.** 반대 방향 친구 신청은 순차 실행만 확인한다.
- 브라우저 검증도 Auth 로그인·갱신·로그아웃, analytics, 포인트, 결제, Storage·Realtime을 실제 서비스와 연결해 확인하지 않는다. `site_visits`는 가상 성공, 홈 보조 데이터·일부 GET은 빈 응답, `claim_mission`은 0점 stub이다. 오류 주입은 지정 RPC의 503 응답을 한 번 돌려준다.
- SQL·브라우저 통과가 운영 배포 반영·운영 RLS 전체·기존 데이터의 과거 중복 행 정리를 보증하지는 않는다. UI 계약 테스트는 별도의 `scripts/test-comment-contracts.mjs`를 사용한다.
