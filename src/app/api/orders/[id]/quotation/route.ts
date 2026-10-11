import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { recordOrderEvent, transitionOrder } from '@/lib/dispatch'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const order = await db.order.findUnique({ where: { id } })
  if (!order) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  // POST /api/orders/:id/quotation?action=approve|reject
  const action = body.action || 'approve'
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  if (order.quotationStatus !== 'REQUESTED') {
    return NextResponse.json({ error: 'QUOTATION_NOT_PENDING' }, { status: 400 })
  }

  if (action === 'approve') {
    const approvedAmount = body.amount || order.estimatedFare
    await db.order.update({
      where: { id },
      data: {
        quotationStatus: 'APPROVED',
        quotationAmount: approvedAmount,
        quotationApprovedById: user.id,
        quotationApprovedAt: new Date(),
        estimatedFare: approvedAmount,
        status: 'QUOTATION_APPROVED',
      }
    })
    await recordOrderEvent(id, {
      eventType: 'QUOTATION_APPROVED',
      fromStatus: order.status,
      toStatus: 'QUOTATION_APPROVED',
      actorId: user.id,
      actorType: 'ADMIN',
      metadata: { amount: approvedAmount }
    })
    // Auto-dispatch
    await db.order.update({ where: { id }, data: { status: 'REQUESTED' } })
    const { dispatchOrder } = await import('@/lib/dispatch')
    await dispatchOrder(id)
    return NextResponse.json({ ok: true, status: 'QUOTATION_APPROVED' })
  } else if (action === 'reject') {
    await db.order.update({
      where: { id },
      data: { quotationStatus: 'REJECTED', status: 'CANCELLED_BY_SYSTEM', cancelledAt: new Date(), cancelledBy: 'ADMIN' }
    })
    await recordOrderEvent(id, {
      eventType: 'QUOTATION_REJECTED',
      fromStatus: order.status,
      toStatus: 'CANCELLED_BY_SYSTEM',
      actorId: user.id,
      actorType: 'ADMIN',
    })
    return NextResponse.json({ ok: true, status: 'QUOTATION_REJECTED' })
  }
  return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 })
}
