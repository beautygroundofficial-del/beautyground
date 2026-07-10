// 뷰티그라운드 사이트에서 실행되는 브릿지 — 확장이 저장해둔 상품 데이터를
// 등록폼(ProductForm)에 window.postMessage 로 전달한다.
// 프로토콜: 폼이 mount 시 BG_EXT_FORM_READY 를 쏘면 → 대기 데이터를 BG_EXT_IMPORT 로 전달
//          폼이 반영 완료하면 BG_EXT_IMPORT_ACK → 대기 데이터 삭제(1회성)

function deliverPending() {
  try {
    chrome.storage.local.get('pendingImport', ({ pendingImport }) => {
      if (!pendingImport) return
      window.postMessage({ type: 'BG_EXT_IMPORT', payload: pendingImport }, '*')
    })
  } catch (_) { /* 확장 컨텍스트 무효화 등 — 무시 */ }
}

window.addEventListener('message', (e) => {
  if (e.source !== window || !e.data) return
  if (e.data.type === 'BG_EXT_FORM_READY') deliverPending()
  if (e.data.type === 'BG_EXT_IMPORT_ACK') {
    try { chrome.storage.local.remove('pendingImport') } catch (_) { /* ignore */ }
  }
})

// 폼이 이미 떠 있는 상태에서 데이터가 도착하는 경우를 위해 진입 시에도 한 번 시도
deliverPending()
