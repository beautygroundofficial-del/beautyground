import { supabase } from './supabase'
import type { Product } from './types'

export interface CartLine {
  id: string // cart_items.id
  quantity: number
  product: Product
}

// 로그인한 고객의 장바구니 (상품 조인 포함)
export async function getCart(): Promise<CartLine[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) return []

  const { data } = await supabase
    .from('cart_items')
    .select('id, quantity, products(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return ((data ?? []) as unknown as { id: string; quantity: number; products: Product | null }[])
    .filter((row) => row.products)
    .map((row) => ({ id: row.id, quantity: row.quantity, product: row.products as Product }))
}

// 담기: 이미 있으면 수량 합산 (unique(user_id, product_id) 이용)
export async function addToCart(productId: string, quantity = 1): Promise<{ error?: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) return { error: 'not_logged_in' }

  const { data: existing } = await supabase
    .from('cart_items')
    .select('id, quantity')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('cart_items')
      .update({ quantity: (existing as { quantity: number }).quantity + quantity })
      .eq('id', (existing as { id: string }).id)
    if (error) return { error: error.message }
    return {}
  }

  const { error } = await supabase
    .from('cart_items')
    .insert({ user_id: userId, product_id: productId, quantity })
  if (error) return { error: error.message }
  return {}
}

export async function updateCartQuantity(cartItemId: string, quantity: number): Promise<void> {
  await supabase.from('cart_items').update({ quantity: Math.max(1, quantity) }).eq('id', cartItemId)
}

export async function removeFromCart(cartItemId: string): Promise<void> {
  await supabase.from('cart_items').delete().eq('id', cartItemId)
}

export async function clearCartItems(cartItemIds: string[]): Promise<void> {
  if (cartItemIds.length === 0) return
  await supabase.from('cart_items').delete().in('id', cartItemIds)
}
