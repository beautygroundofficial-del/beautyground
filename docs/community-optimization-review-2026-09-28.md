# 커뮤니티 최적화 독립 검토

2026-09-28. 글·댓글·친구·재방문 흐름의 실제 오류를 검토했다. 판매·수수료·포인트 정책, 운영 DB 변경은 이번 검토 범위에 포함하지 않았다. 최초 확인 시 아래 피드·소식 파일은 로컬 `origin/main`의 운영 커밋 `1ca155e`와 같았다.

## 확인한 문제와 수정

- **다른 계정의 소식이 남고 읽음에 사용됨.** A의 소식을 표시한 상태에서 B로 로그인하고 B의 조회가 실패하면 A의 목록이 남았다. 그 목록의 시각으로 B의 읽음을 저장할 수 있었다. `AppNews.tsx`는 인증 사용자와 성공한 조회 결과를 연결하고, 계정 변경·로그아웃 때 기존 목록과 진행 중 요청을 무효화한다. 조회 실패 후에는 읽음을 허용하지 않으며, 저장 직전 현재 세션을 다시 확인한다.
- **현재 정렬 재클릭 후 본문이 사라짐.** `AppDiary.tsx`에서 선택된 정렬을 다시 누르면 로딩 상태만 바뀌고 조회 효과는 재실행되지 않았다. 같은 정렬 클릭을 무시하도록 수정했다.
- **홈 조회 오류를 빈 커뮤니티로 안내함.** `DiaryHomeFeed.tsx`는 오류를 빈 배열로 바꾸는 조회를 사용했다. 오류를 전달하는 기존 `getConversationFeed`로 전환하고 오류 안내·재시도를 추가했다. 영상도 글 이동 버튼 밖으로 분리했다.

추가로 글쓰기 변경 5개 파일(`PostComposer`, `AppDiaryWrite`, `AppBoardWrite`, `lib/diaries`, `lib/board`)을 독립 검토했다. 계정별 초안, 닉네임 확인 후 제출, 사진 일부 업로드 실패 시 게시 중단, 실패 후 저장 상태 해제, 실제 수정 대상 행이 반환될 때만 성공으로 판단하는 경로를 확인했다. 초기 세션 조회 중 계정이 바뀌면 이전 초안을 복원할 수 있는 경합을 발견했고, 인증 이벤트에서 관찰한 사용자와 조회 결과를 대조하는 보완 후 다시 검사했다.

## 검증 근거

| 검사 | 결과 | 범위 |
|---|---:|---|
| 수정 전 홈 오류 재현 | 확인 | 로컬 운영형 preview에 조회 503을 주입하면 ‘아직 아무도 오늘을 남기지 않았어요’ 표시. 오류 안내를 요구하는 회귀가 예상대로 실패함 |
| 수정 후 홈·이야기 브라우저 | 6/6 | 오류·빈 목록 구분, 재시도, 정확한 원글 이동, 동일 정렬 반복 클릭, 정상 빈 목록, 영상과 글 이동 분리. JavaScript 오류 0 |
| 소식 소스 실행 모의 | 8/8 | 계정 전환·로그아웃·늦은 이전 응답·조회 실패·읽음 직전 계정 변경·현재 계정의 정상 읽음 |
| 글쓰기 초기 인증 경합 모의 | 4/4 | 두 작성 화면 각각 초기 A 조회 중 B 로그인 또는 로그아웃. 이전 초안 로드 없이 작성 비활성·로그인 복귀 |
| 글 수정 결과 판정 모의 | 8/8 | 두 라이브러리에서 대상 행 반환·0행·다른 행·오류 응답의 성공 판정 |

브라우저 검사 파일은 `scripts/community-tests/test-community-feed.py`다. loopback 주소만 앱 주소로 받으며 외부 HTTP 요청은 가상 응답으로 대체하거나 차단하고 서비스 워커·WebSocket을 차단한다. 공용 SQL fixture나 운영 DB를 사용하지 않는다. 같은 머신의 Vite HMR과 동기 Playwright 조합에서 탐색이 지연되어, 최종 검사는 HMR 없는 로컬 운영형 preview `5210`에서 수행했다.

```powershell
$env:APP = 'http://127.0.0.1:5210'
$env:TEST_OUTPUT = 'C:/Users/Public/Documents/ESTsoft/CreatorTemp/community-optimize-20260928/feed-after'
python -B scripts/community-tests/test-community-feed.py
node scripts/community-tests/test-app-news.cjs
node scripts/community-tests/test-writer-auth-race.cjs
node scripts/community-tests/test-community-update-results.cjs
```

Node 검사는 저장소의 실제 TS/TSX를 TypeScript로 메모리 변환해 실행하며 인증·RPC·React hooks는 제어 가능한 모의 객체다. 기본 소스 위치는 검사 파일 기준 저장소 루트이며 `COMMUNITY_TEST_REPO`로 다른 검토 사본을 지정할 수 있다. 해당 저장소에 프로젝트의 TypeScript 의존성이 설치되어 있어야 한다.

전후 증거는 `C:/Users/Public/Documents/ESTsoft/CreatorTemp/community-optimize-20260928/feed-before/`와 `feed-after/`에 저장했다. 브라우저의 실제 Auth·Storage·운영 권한·실기기·영상 디코딩 및 모든 토큰 변경 경합의 원자성을 검증한 것은 아니다. 기존 댓글·친구 전체 회귀, 최종 빌드와 배포 여부는 상위 작업의 검증 기록을 따른다.
