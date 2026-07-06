import { chromium } from 'playwright'
import fs from 'fs'

const SUPA='https://bjqtuklkskrqzbuxdwxm.supabase.co'
const ANON='sb_publishable_nuBbC2D1_S_eV0fA9OAjhQ_ntsloX0Q'
const TOKEN=fs.readFileSync('token.txt','utf8').trim()
const SKIP=new Set(['8de9a884-f5ca-4db3-85ed-b9ea3407b225','c234c1c3-47b6-4cc0-af43-96c883578abf']) // fix-2products로 이미 완료(재로딩 실패 덮어쓰기 방지)
const items=JSON.parse(fs.readFileSync('all-products.json','utf8').replace(/^[^\[{]+/, '')).filter(p=>!SKIP.has(p.id))
const CONC=2
console.log(`전체 ${items.length}개 · 병렬 ${CONC}워커로 시작(상세 로딩 대기 강화)`)

const browser = await chromium.launch({ headless:true, args:['--no-sandbox'] })

async function extract(page, url){
  await page.goto(url, { waitUntil:'networkidle', timeout:45000 })
  await page.waitForTimeout(1500)
  // 천천히 끝까지 스크롤(지연로딩 유도) + 바닥까지
  for(let i=0;i<28;i++){ await page.mouse.wheel(0,2500); await page.waitForTimeout(200) }
  await page.evaluate(()=>window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(800)
  // 상세 컨테이너에 실제 컷(upload/product 세부)이 뜰 때까지 대기(최대 12초)
  await page.waitForFunction(()=>{
    const el=document.querySelector('#prdDetail .cont')||document.querySelector('#prdDetail')
    if(!el) return false
    return Array.from(el.querySelectorAll('img')).some(im=>{const s=(im.getAttribute('ec-data-src')||im.currentSrc||im.src||''); return /\/upload\/NNEditor\/|\/upload\/product\/(koelf|petitfee|etc)/.test(s)})
  }, { timeout:12000 }).catch(()=>{})
  await page.waitForTimeout(1200)
  return await page.evaluate(()=>{
    const NOISE=/img\.echosting\.cafe24\.com|\.gif(\?|$)|\/icon|\/btn|banner|logo|blank|spacer|sprite|\/(top|bottom)\d+_|txt_naver/i
    const realSrc=(im)=>{ const ec=im.getAttribute('ec-data-src'); if(ec) return ec; return im.currentSrc||im.src||im.getAttribute('data-src')||'' }
    const collect=(sel)=>{ const el=document.querySelector(sel); if(!el) return []; const seen=new Set(); const out=[]
      Array.from(el.querySelectorAll('img')).forEach(im=>{ const s=realSrc(im); if(!s||s.startsWith('data:')||NOISE.test(s)) return; const abs=s.startsWith('http')?s:new URL(s,location.href).href; if(seen.has(abs))return; seen.add(abs); out.push(abs) }); return out }
    const optSel=['.xans-product-addproduct','.xans-product-option','.xans-product-relationproduct','[class*="addProduct"]']
    const optSet=new Set(); optSel.forEach(s=>collect(s).forEach(u=>optSet.add(u)))
    const key=collect('.keyImg').filter(u=>!optSet.has(u))
    const add=collect('.xans-product-addimage').filter(u=>!optSet.has(u))
    let gallery
    if(key.length && add.length) gallery=[key[0], ...add.slice(1)]
    else if(add.length) gallery=add
    else gallery=collect('.xans-product-image').filter(u=>!optSet.has(u))
    const detail=collect('#prdDetail .cont')
    return { gallery, detail }
  })
}

let idx=0; const results=[]
async function worker(wid){
  const ctx=await browser.newContext({ locale:'ko-KR', viewport:{width:1440,height:1400} })
  const page=await ctx.newPage()
  while(true){
    const i=idx++; if(i>=items.length) break
    const it=items[i]
    try{
      const ex=await extract(page, it.source_url)
      if(!ex.gallery.length && !ex.detail.length) throw new Error('이미지0')
      const payload={ gallery_images:ex.gallery, detail_images:ex.detail, thumbnail_url:ex.gallery[0]||null }
      const resp=await fetch(`${SUPA}/rest/v1/products?id=eq.${it.id}`,{ method:'PATCH', headers:{apikey:ANON,Authorization:`Bearer ${TOKEN}`,'Content-Type':'application/json',Prefer:'return=minimal'}, body:JSON.stringify(payload) })
      const ok=resp.status===204||resp.status===200
      results.push({ id:it.id, name:it.name, ok, g:ex.gallery.length, d:ex.detail.length, status:resp.status })
      console.log(`${ok?'✅':'❌'} [w${wid}] ${it.name}  갤러리${ex.gallery.length}/상세${ex.detail.length} [${resp.status}]`)
    }catch(e){
      results.push({ id:it.id, name:it.name, ok:false, err:e.message.slice(0,60) })
      console.log(`❌ [w${wid}] ${it.name}  ${e.message.slice(0,60)}`)
    }
  }
  await ctx.close()
}
await Promise.all(Array.from({length:CONC},(_,w)=>worker(w+1)))
const okc=results.filter(r=>r.ok).length
console.log(`\n===== 완료: 성공 ${okc}/${results.length} =====`)
results.filter(r=>!r.ok).forEach(r=>console.log(`  실패 ${r.name} ${r.err||r.status}`))
fs.writeFileSync('fix-batch2-result.json', JSON.stringify(results,null,2),'utf8')
await browser.close()
