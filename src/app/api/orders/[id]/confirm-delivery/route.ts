import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { transitionOrder } from '@/lib/dispatch'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const order = await db.order.findUnique({ where: { id } })
  if (!order) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  if (user.role === 'CUSTOMER' && order.customerId !== user.id) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }
  // Verify delivery confirmation code if set
  if (order.deliveryConfirmCode && body.code !== order.deliveryConfirmCode) {
    return NextResponse.json({ error: 'INVALID_CONFIRMATION_CODE' }, { status: 400 })
  }
  try {
    const result = await transitionOrder(id, 'COMPLETED', {
      id: user.id, type: user.role as 'CUSTOMER' | 'DRIVER'
    })
    await db.order.update({
      where: { id },
      data: { deliveredAt: new Date() }
    })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
