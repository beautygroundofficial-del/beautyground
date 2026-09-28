import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bjqtuklkskrqzbuxdwxm.supabase.co'
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
const SITE = 'https://beautyground.co.kr'

const STATIC_PATHS = ['/', '/app/category', '/company', '/about', '/terms', '/privacy', '/account-delete']

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const urls: { loc: string; changefreq: string; priority: string }[] = STATIC_PATHS.map((p) => ({
    loc: `${SITE}${p}`,
    changefreq: p === '/' ? 'daily' : 'weekly',
    priority: p === '/' ? '1.0' : '0.6',
  }))

  if (SERVICE_ROLE) {
    try {
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
      const { data: products } = await supabase
        .from('products')
        .select('id, category')
        .eq('status', 'on_sale')
      for (const p of (products ?? []) as { id: string; category: string | null }[]) {
        urls.push({ loc: `${SITE}/app/product/${p.id}`, changefreq: 'weekly', priority: '0.8' })
      }
      const categories = new Set(
        (products ?? [])
          .map((p) => (p as { category: string | null }).category)
          .filter((c): c is string => !!c)
      )
      for (const c of categories) {
        urls.push({ loc: `${SITE}/app/category?cat=${encodeURIComponent(c)}`, changefreq: 'weekly', priority: '0.7' })
      }
    } catch (e) {
      console.error('[sitemap] products 조회 실패:', e)
    }
  }

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls
      .map(
        (u) =>
          `  <url><loc>${xmlEscape(u.loc)}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`
      )
      .join('\n') +
    '\n</urlset>\n'

  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
  res.status(200).send(body)
}
