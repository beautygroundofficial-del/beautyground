import { supabase } from './supabase'

export interface Address {
  id: string
  label: string | null
  recipient_name: string
  phone: string
  address: string
  is_default: boolean
  created_at: string
}

export async function getAddresses(): Promise<Address[]> {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) return []
  const { data } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })
  return (data ?? []) as Address[]
}

export async function getDefaultAddress(): Promise<Address | null> {
  const list = await getAddresses()
  return list.find((a) => a.is_default) ?? list[0] ?? null
}

// 새 배송지 저장. 첫 배송지거나 makeDefault=true 면 기본으로 지정.
export async function addAddress(input: {
  recipientName: string
  phone: string
  address: string
  label?: string
  makeDefault?: boolean
}): Promise<{ error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) return { error: 'not_logged_in' }

  const existing = await getAddresses()
  const shouldBeDefault = input.makeDefault || existing.length === 0

  if (shouldBeDefault && existing.length > 0) {
    await supabase.from('addresses').update({ is_default: false }).eq('user_id', userId)
  }

  const { error } = await supabase.from('addresses').insert({
    user_id: userId,
    label: input.label ?? null,
    recipient_name: input.recipientName,
    phone: input.phone,
    address: input.address,
    is_default: shouldBeDefault,
  })
  if (error) return { error: error.message }
  return {}
}

export async function setDefaultAddress(addressId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) return
  await supabase.from('addresses').update({ is_default: false }).eq('user_id', userId)
  await supabase.from('addresses').update({ is_default: true }).eq('id', addressId)
}

export async function deleteAddress(addressId: string): Promise<void> {
  await supabase.from('addresses').delete().eq('id', addressId)
}
