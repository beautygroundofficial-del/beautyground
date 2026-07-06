import { chromium } from 'playwright'
import fs from 'fs'

const SUPA='https://bjqtuklkskrqzbuxdwxm.supabase.co'
const ANON='sb_publishable_nuBbC2D1_S_eV0fA9OAjhQ_ntsloX0Q'
const TOKEN=fs.readFileSync('token.txt','utf8').trim()

// 인자: <productId> <petitfeeUrl> [apply]
const ID=process.argv[2]
const URL=process.argv[3]
const APPLY=process.argv[4]==='apply'
if(!ID||!URL){ console.log('usage: node fix-product.mjs <id> <url> [apply]'); process.exit(1) }

const browser = await chromium.launch({ headless:true, args:['--no-sandbox'] })
const page = await browser.newContext({ locale:'ko-KR', viewport:{width:1440,height:1400} }).then(c=>c.newPage())
await page.goto(URL, { waitUntil:'networkidle', timeout:45000 })
await page.waitForTimeout(2000)
for(let i=0;i<22;i++){ await page.mouse.wheel(0,3000); await page.waitForTimeout(200) }
await page.waitForTimeout(2500)

const ex = await page.evaluate(()=>{
  const NOISE=/img\.echosting\.cafe24\.com|\.gif(\?|$)|\/icon|\/btn|banner|logo|blank|spacer|sprite|\/(top|bottom)\d+_|txt_naver/i
  const realSrc=(im)=>{ let s=im.getAttribute('ec-data-src')||im.currentSrc||im.src||im.getAttribute('data-src')||''; const ss=im.getAttribute('srcset'); if(ss){const last=ss.split(',').map(x=>x.trim().split(' ')[0]).filter(Boolean).pop(); if(last)s=last} return s }
  // 스페이서/얇은 배지 제외: 로드된 자연크기가 극도로 얇거나 작으면 버림
  const isSpacer=(im)=>{ const w=im.naturalWidth,h=im.naturalHeight; if(!w||!h) return false; return w<=8||h<=12||(w/h)>=25||(h/w)>=60 }
  const collect=(sel)=>{ const el=document.querySelector(sel); if(!el) return []; const seen=new Set(); const out=[]
    Array.from(el.querySelectorAll('img')).forEach(im=>{ const s=realSrc(im); if(!s||s.startsWith('data:')||NOISE.test(s)) return; if(isSpacer(im)) return; const abs=s.startsWith('http')?s:new URL(s,location.href).href; if(seen.has(abs))return; seen.add(abs); out.push(abs) }); return out }
  // 옵션영역 이미지(제외 대상) 수집 → 갤러리에서 반드시 빼기
  const optSel=['.xans-product-addproduct','.xans-product-option','.xans-product-relationproduct','[class*="addProduct"]']
  const optSet=new Set(); optSel.forEach(s=>collect(s).forEach(u=>optSet.add(u)))
  // 갤러리 = 대표(keyImg, 고해상) + 추가썸네일(addimage) 2번째부터(중복 대표-small 제외)
  const key=collect('.keyImg').filter(u=>!optSet.has(u))
  const add=collect('.xans-product-addimage').filter(u=>!optSet.has(u))
  let gallery
  if(key.length && add.length) gallery=[key[0], ...add.slice(1)]
  else if(add.length) gallery=add
  else gallery=collect('.xans-product-image').filter(u=>!optSet.has(u))
  const detail=collect('#prdDetail .cont')
  return { gallery, detail, optionCount:optSet.size }
})
await browser.close()

console.log(`[${ID}] gallery ${ex.gallery.length}장 / detail ${ex.detail.length}장 / 옵션영역 ${ex.optionCount}장(제외)`)
console.log('gallery:'); ex.gallery.forEach((s,i)=>console.log(`  ${i+1}. ${s.replace('https://www.petitfee.com/web/','…/')}`))
console.log('detail(순서대로):'); ex.detail.forEach((s,i)=>console.log(`  ${i+1}. ${s.replace('https://www.petitfee.com/web/','…/')}`))

if(!APPLY){ console.log('\n[미적용]'); process.exit(0) }
const payload={ gallery_images:ex.gallery, detail_images:ex.detail, thumbnail_url:ex.gallery[0]||null }
const resp=await fetch(`${SUPA}/rest/v1/products?id=eq.${ID}`,{ method:'PATCH', headers:{apikey:ANON,Authorization:`Bearer ${TOKEN}`,'Content-Type':'application/json',Prefer:'return=minimal'}, body:JSON.stringify(payload) })
console.log('\nPATCH', resp.status, resp.status===204?'OK':await resp.text())
