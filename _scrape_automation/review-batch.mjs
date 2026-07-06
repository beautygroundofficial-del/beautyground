import { chromium } from 'playwright'
import fs from 'fs'
import { scrapeReviewSummary } from './scrape-review-summary.mjs'

const SUPA='https://bjqtuklkskrqzbuxdwxm.supabase.co'
const ANON='sb_publishable_nuBbC2D1_S_eV0fA9OAjhQ_ntsloX0Q'
const TOKEN=fs.readFileSync('token.txt','utf8').trim()
const items=JSON.parse(fs.readFileSync('all-products.json','utf8').replace(/^[^\[{]+/, ''))
const CONC=2
console.log(`리뷰 요약 수집 ${items.length}개 · 병렬 ${CONC}`)

const browser = await chromium.launch({ headless:true, args:['--no-sandbox'] })
let idx=0; const results=[]
async function worker(w){
  const ctx=await browser.newContext({ locale:'ko-KR', viewport:{width:1440,height:1600} })
  const page=await ctx.newPage()
  while(true){
    const i=idx++; if(i>=items.length) break
    const it=items[i]
    try{
      const s=await scrapeReviewSummary(page, it.source_url, { pages:3, maxPhotos:12 })
      const summary={ count:s.count||0, avg:s.avg, photos:s.photos||[] }
      const resp=await fetch(`${SUPA}/rest/v1/products?id=eq.${it.id}`,{method:'PATCH',headers:{apikey:ANON,Authorization:`Bearer ${TOKEN}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({ review_summary:summary })})
      const ok=resp.status===204||resp.status===200
      results.push({id:it.id,name:it.name,ok,count:summary.count,avg:summary.avg,photos:summary.photos.length,status:resp.status})
      console.log(`${ok?'✅':'❌'} [w${w}] ${it.name} 리뷰${summary.count}/평점${summary.avg}/사진${summary.photos.length} [${resp.status}]`)
      if(!ok && resp.status!==204){ const t=await resp.text(); if(/column.*review_summary|does not exist/i.test(t)){ console.log('   ⚠ review_summary 컬럼 없음 — SQL 먼저 실행 필요'); } }
    }catch(e){ results.push({id:it.id,name:it.name,ok:false,err:e.message.slice(0,60)}); console.log(`❌ [w${w}] ${it.name} ${e.message.slice(0,60)}`) }
  }
  await ctx.close()
}
await Promise.all(Array.from({length:CONC},(_,w)=>worker(w+1)))
const ok=results.filter(r=>r.ok).length
console.log(`\n완료: 성공 ${ok}/${results.length}`)
fs.writeFileSync('review-batch-result.json', JSON.stringify(results,null,2),'utf8')
await browser.close()
