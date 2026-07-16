#Requires AutoHotkey v2.0
#SingleInstance Force  ; 중복 실행 방지 — 새로 실행하면 기존 것을 자동 종료
; ─────────────────────────────────────────────────────────────
;  음성 자동 전송 (F9 토글 방식)
;
;  F9  : 받아쓰기 시작  →  말하기  →  F9 다시 누르면 즉시 전송(Enter)
;  Esc : 받아쓰기 중 취소 (전송 안 함)
;
;  ※ 한국어 인식은 키보드가 한글(한/영) 상태여야 합니다.
; ─────────────────────────────────────────────────────────────

global armed := false

ShowState(txt) {
    ToolTip(txt, A_ScreenWidth - 300, A_ScreenHeight - 90)
}

F9:: {
    global armed
    if (!armed) {
        ; 시작
        armed := true
        Send("#h")
        ShowState("🎙 말하세요 — 끝나면 F9 (취소는 Esc)")
    } else {
        ; 종료 + 전송
        armed := false
        ShowState("⏳ 인식 확정 중...")
        Sleep(800)            ; 마지막 문장이 인식 확정될 시간
        Send("#h")            ; 받아쓰기 닫기
        Sleep(1000)           ; 받아쓰기 창이 닫히고 텍스트가 입력창에 반영될 시간
        Send("{Enter}")
        ShowState("✅ 전송됨")
        SetTimer(() => ToolTip(), -1200)
    }
}

#HotIf armed
Esc:: {
    global armed
    armed := false
    Send("#h")
    ShowState("✖ 취소")
    SetTimer(() => ToolTip(), -1200)
}
#HotIf
