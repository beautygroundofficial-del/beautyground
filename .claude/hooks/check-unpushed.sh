#!/usr/bin/env bash
# 세션 종료 시 실행: 커밋 안 된 변경이나 GitHub에 push 안 된 커밋이 있으면 경고 메시지 출력.
# .claude/settings.json 의 SessionEnd 훅이 호출. 양쪽 컴(집/사무실)에 git으로 공유됨.
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

dirty=$(git status --porcelain 2>/dev/null)
ahead=$(git rev-list --count '@{u}..HEAD' 2>/dev/null)
[ -z "$ahead" ] && ahead=0

if [ -n "$dirty" ] || [ "$ahead" -gt 0 ]; then
  msg="⚠️ 홈페이지 변경이 아직 GitHub에 안 올라갔습니다! 종료 전 git add -A → git commit → git push 잊지 마세요."
  if [ "$ahead" -gt 0 ]; then
    msg="$msg (미푸시 커밋 ${ahead}개)"
  fi
  # Claude Code 에 systemMessage 로 표시
  printf '{"systemMessage":"%s"}' "$msg"
fi
