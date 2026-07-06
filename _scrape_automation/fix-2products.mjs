import { chromium } from 'playwright'
import fs from 'fs'
const SUPA='https://bjqtuklkskrqzbuxdwxm.supabase.co'
const ANON='sb_publishable_nuBbC2D1_S_eV0fA9OAjhQ_ntsloX0Q'
const TOKEN=fs.readFileSync('token.txt','utf8').trim()
const targets=[
  { id:'8de9a884-f5ca-4db3-85ed-b9ea3407b225', url:'https://www.petitfee.com/product/뷰티파잉-포어-패드/917/category/123/display/1/' },
  { id:'c234c1c3-47b6-4cc0-af43-96c883578abf', url:'https://www.petitfee.com/product/마데카소사이드-클래릴파잉-바디-스프레이바디트러블-미스트/284/category/93/display/1/' },
]
const browser = await chromium.launch({ headless:true, args:['--no-sandbox'] })
const page = await browser.newContext({ locale:'ko-KR', viewport:{width:1440,height:1600} }).then(c=>c.newPage())

async function loadOnce(url){
  await page.goto(url,{waitUntil:'networkidle',timeout:45000})
  await page.waitForTimeout(2000)
  for(let i=0;i<22;i++){ await page.mouse.wheel(0,2500); await page.waitForTimeout(200) }
  await page.waitForTimeout(2500)
  return await page.evaluate(()=>{
    const el=document.querySelector('#prdDetail .cont'); if(!el) return 0
    return Array.from(el.querySelectorAll('img')).filter(im=>{const s=(im.getAttribute('ec-data-src')||im.currentSrc||im.src||''); return /\/upload\/(NNEditor|product\/(koelf|petitfee|etc|maskpack))/.test(s)}).length
  })
}
async function extract(url){
  // 상세가 로딩될 때까지 최대 4회 리로드 재시도
  for(let a=0;a<4;a++){ const n=await loadOnce(url); console.log(`   시도${a+1}: 상세컷 ${n}장`); if(n>0) break }
  return await page.evaluate(()=>{
    const NOISE=/img\.echosting\.cafe24\.com|\.gif(\?|$)|\/icon|\/btn|banner|logo|blank|spacer|sprite|\/(top|bottom)\d+_|txt_naver/i
    const realSrc=(im)=>{ const ec=im.getAttribute('ec-data-src'); if(ec) return ec; return im.currentSrc||im.src||im.getAttribute('data-src')||'' }
    // 스페이서/배지는 NOISE(파일명 top/bottom, gif 등)로 제외. naturalWidth 기반 판정은 지연이미지를 오인하므로 안 씀.
    const collect=(sel)=>{ const el=document.querySelector(sel); if(!el) return []; const seen=new Set(); const out=[]
      Array.from(el.querySelectorAll('img')).forEach(im=>{ const s=realSrc(im); if(!s||s.startsWith('data:')||NOISE.test(s)) return; const abs=s.startsWith('http')?s:new URL(s,location.href).href; if(seen.has(abs))return; seen.add(abs); out.push(abs) }); return out }
    const optSel=['.xans-product-addproduct','.xans-product-option','.xans-product-relationproduct','[class*="addProduct"]']
    const optSet=new Set(); optSel.forEach(s=>collect(s).forEach(u=>optSet.add(u)))
    const key=collect('.keyImg').filter(u=>!optSet.has(u))
    const add=collect('.xans-product-addimage').filter(u=>!optSet.has(u))
    let gallery = key.length&&add.length ? [key[0],...add.slice(1)] : (add.length?add:collect('.xans-product-image').filter(u=>!optSet.has(u)))
    const detail=collect('#prdDetail .cont')
    return { gallery, detail }
  })
}
for(const t of targets){
  const ex=await extract(t.url)
  console.log(`갤러리${ex.gallery.length}/상세${ex.detail.length}`)
  ex.detail.forEach((s,i)=>console.log(`   상세${i+1}. ${s.replace('https://www.petitfee.com/web/','…/')}`))
  if(ex.detail.length){
    const payload={ gallery_images:ex.gallery, detail_images:ex.detail, thumbnail_url:ex.gallery[0]||null }
    const resp=await fetch(`${SUPA}/rest/v1/products?id=eq.${t.id}`,{method:'PATCH',headers:{apikey:ANON,Authorization:`Bearer ${TOKEN}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(payload)})
    console.log('   PATCH', resp.status)
  } else console.log('   상세 여전히 0 — PATCH 안함')
}
await browser.close()
