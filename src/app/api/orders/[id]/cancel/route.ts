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
  try {
    const toStatus = user.role === 'CUSTOMER' ? 'CANCELLED_BY_CUSTOMER' : 'CANCELLED_BY_DRIVER'
    const result = await transitionOrder(id, toStatus, {
      id: user.id,
      type: user.role as 'CUSTOMER' | 'DRIVER'
    })
    if (body.reason) {
      await db.order.update({ where: { id }, data: { cancelReason: body.reason } })
    }
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
