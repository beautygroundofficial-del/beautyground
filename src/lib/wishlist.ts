import { supabase } from './supabase'
import type { Product } from './types'

export interface WishlistLine {
  id: string // wishlist_items.id
  product: Product
}

export async function getWishlist(): Promise<WishlistLine[]> {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) return []
  const { data } = await supabase
    .from('wishlist_items')
    .select('id, products(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return ((data ?? []) as unknown as { id: string; products: Product | null }[])
    .filter((row) => row.products)
    .map((row) => ({ id: row.id, product: row.products as Product }))
}

export async function isWished(productId: string): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) return false
  const { data } = await supabase
    .from('wishlist_items')
    .select('id')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .maybeSingle()
  return !!data
}

export async function addWish(productId: string): Promise<{ error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) return { error: 'not_logged_in' }
  const { error } = await supabase.from('wishlist_items').insert({ user_id: userId, product_id: productId })
  if (error && !error.message.includes('duplicate')) return { error: error.message }
  return {}
}

export async function removeWish(productId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) return
  await supabase.from('wishlist_items').delete().eq('user_id', userId).eq('product_id', productId)
}
