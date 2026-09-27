# 커뮤니티 운영 배포

대표님의 “배포해” 지시에 따라 2026-09-28(KST) 커뮤니티 기능·UI 수정과 연결에 필요한 DB 함수 변경을 운영 반영했다. 다른 기능 브랜치 전체를 병합하지 않고, 최신 운영 기준 `c73797b` 위의 선별 커밋만 사용했다.

## 배포 대상

- 운영 커밋: `1ca155e67bcef12802d83db1fca63d267b3007e3`.
- 포함: `3dee625` 댓글·친구·소식 통합, `f950355` 1차 UI 정돈, `65c6c3a` 작성자 상단·외곽 박스 제거·댓글 구획, `1ca155e` 실제 운영 권한을 반영한 SQL 보완.
- 운영 도메인: https://beautyground.co.kr/app/home .
- DB: 쇼핑몰 프로젝트 `bjqtuklkskrqzbuxdwxm`. 기존 함수 7개 정의·권한 백업, 신규 5개 구분, 복구 SQL 저장 후 두 SQL을 하나의 트랜잭션으로 적용했다. 역방향 친구 중복은 적용 직전 0건이었다.
- 변경 SQL: `supabase/community_conversation_integration.sql`, `supabase/community_friend_request_lock.sql`. 기존 게시글·댓글·친구 행 일괄 수정은 없었다.

## 적용 직전 보완

실제 기존 함수에는 익명 역할의 명시적 실행 권한이 있었다. `PUBLIC` 권한만 회수해도 익명 권한이 남으므로 로그인 전용 친구·소식 함수 6개에서 `PUBLIC, anon`을 함께 회수하도록 보완했다. 운영 계정이나 다른 권한 정책을 일괄 변경하지 않았다.

격리 회귀 시험에 기존 함수의 익명 명시 권한과 신규 함수의 익명 기본 권한을 재현했다. 보완 SQL로 **9/9 통과**, 이전 `PUBLIC`만 회수하는 SQL을 메모리에서 대입하면 관련 검사가 실패하는 것도 확인했다.

## 검증

- 최종 운영 후보에서 `npm run build` 통과. 앞선 UI 변경의 댓글·친구 등 두 사용자 격리 브라우저 검사16/16과 24개 반응형 화면 점검 기록은 이전 문서를 참고한다.
- 운영 적용 후 12개 함수의 본문·실효 실행 권한·security definer·search_path를 대조해 일치 확인.
- 실제 REST API 공개 조회 6개 200, 로그인 전용 소식 조회 2개는 익명 호출401 확인.
- 읽기 전용 트랜잭션 안에서 기존 테스트 사용자 claim과 authenticated 역할로 새/기존 소식·배지 조회 성공. 실제 Auth 로그인·운영 회원 댓글 작성·친구 신청은 실행하지 않았다.
- 공개 일기 조회 성공 및 숨김 일기·댓글·게시판 댓글·답변 조회 결과0 확인. 직접 REST 테이블 RLS 전반을 보증하는 검사는 아니다.
- 정확한 커밋의 GitHub 상태에서 `Vercel – beautyground`, `Vercel – beautyground-app` 모두 배포 성공을 확인했다. 실제 도메인은 새 JS `index-V-VHpsgS.js`와 CSS `index-BQYVPWLT.css`를 제공하며 CSS는 검토 후보 빌드와 바이트 단위로 같다.
- 운영 홈·이야기·소식·친구를 새 익명 브라우저로 조회했다. 네 화면 모두 HTTP200·JavaScript 예외0·390px 가로 넘침0. 홈/이야기의 작성자 상단·외곽 박스 제거·댓글 표시와 익명 소식/친구의 로그인 안내를 확인했다. 홈과 이야기 실제 캡처를 직접 확인했고 운영 홈을 대표님 브라우저에 열었다.
- 엄격한 운영 점검 원본 결과는 **3/4 통과**다. 홈의 기존 `get_member_count` RPC가404이며 변경하지 않은 AppHeader는 기존 기준값을 표시한다. 별도로 읽기 검사 가드가 `is_admin` 조회를 차단했다. 홈 추가 확인으로 호출명을 확정했으며 저장소 정의는 읽기 전용 SELECT EXISTS다. 앱의 쓰기 시도가 아니라 검사의 `get_*` 허용 규칙에 걸린 조회다. 운영 함수 본문을 추가로 검증한 것은 아니다. 원본 결과와 추가 진단을 보존하며, 회원 수 조회는 별도 미해결 점검 항목으로 남겼다.

증거와 복구 자료: `C:/Users/Public/Documents/ESTsoft/CreatorTemp/community-deploy-20260928/`. `before-functions.json`, `rollback-functions.sql`, `release-plan-current.json`, `applied.json`, `after-functions.json`, `read-verification.json`, `rpc-read-results.json`에 기록했다. 비밀키는 저장소·기록에 포함하지 않는다.

실기기 앱·푸시·Storage·운영 계정 간 쓰기·동시 DB 연결의 잠금 경합은 이번 배포 검증 범위 밖이다. 별도 앱 보안 강화 작업과 다른 세션의 미커밋 변경은 포함하지 않는다.

이전 검토: [기능 통합](community-integration-review-2026-09-27.md), [UI 재수정](community-ui-revision-2026-09-27.md).
