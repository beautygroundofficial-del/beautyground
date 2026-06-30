import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { IconPlus, IconSearch, IconPackage } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { getMyPartner } from '../../lib/partner'
import type { Product } from '../../lib/types'
import PartnerProductCard from '../../components/partner/ProductCard'

type Filter = Product['status'] | 'all'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'on_sale', label: '판매중' },
  { value: 'sold_out', label: '품절' },
  { value: 'hidden', label: '숨김' },
]

export default function PartnerProducts() {
  const [loading, setLoading] = useState(true)
  const [noPartner, setNoPartner] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const load = useCallback(async () => {
    const partner = await getMyPartner()
    if (!partner) {
      setNoPartner(true)
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('partner_id', partner.id)
      .order('created_at', { ascending: false })

    setProducts((data as Product[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    if (!confirm('상품을 삭제하시겠습니까?')) return
    setProducts(prev => prev.filter(p => p.id !== id))
    await supabase.from('products').delete().eq('id', id)
  }

  const handleToggleHide = async (product: Product) => {
    const next: Product['status'] = product.status === 'hidden' ? 'on_sale' : 'hidden'
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, status: next } : p))
    await supabase.from('products').update({ status: next }).eq('id', product.id)
  }

  const visible = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || p.status === filter
    return matchSearch && matchFilter
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-[14px] text-[#9a9080]">불러오는 중...</p>
      </div>
    )
  }

  if (noPartner) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white rounded-[14px] border border-[#e5e0d8] p-10 text-center">
        <p className="text-[16px] font-semibold text-[#111] mb-2">입점 승인 대기 중입니다</p>
        <p className="text-[14px] text-[#9a9080]">승인이 완료되면 상품을 등록할 수 있습니다.</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <IconSearch size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#bbb]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="상품명 검색"
            className="w-full pl-9 pr-4 py-2.5 border border-[#e5e0d8] rounded-lg text-[13px] focus:outline-none focus:border-[#b8924a] transition-colors bg-white"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-4 py-2.5 rounded-lg text-[13px] border transition-colors ${
                filter === value
                  ? 'bg-[#b8924a] text-white border-[#b8924a]'
                  : 'bg-white text-[#555] border-[#e5e0d8] hover:border-[#b8924a]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Link
          to="/partner/products/new"
          className="flex items-center gap-2 bg-[#b8924a] hover:bg-[#a07c3b] text-white px-5 py-2.5 rounded-lg text-[13px] font-semibold transition-colors whitespace-nowrap"
        >
          <IconPlus size={15} />
          상품 등록
        </Link>
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-[14px] border border-[#e5e0d8]">
          <IconPackage size={40} className="text-[#e5e0d8] mx-auto mb-3" />
          <p className="text-[14px] text-[#9a9080] mb-4">
            {search || filter !== 'all' ? '조건에 맞는 상품이 없습니다' : '등록된 상품이 없습니다'}
          </p>
          {!search && filter === 'all' && (
            <Link
              to="/partner/products/new"
              className="inline-flex items-center gap-2 bg-[#b8924a] text-white px-6 py-2.5 rounded-lg text-[13px] font-semibold"
            >
              <IconPlus size={15} />
              상품 등록하기
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {visible.map(product => (
            <PartnerProductCard
              key={product.id}
              product={product}
              onDelete={handleDelete}
              onToggleHide={handleToggleHide}
            />
          ))}
        </div>
      )}
    </>
  )
}
