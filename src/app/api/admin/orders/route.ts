import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const serviceType = searchParams.get('serviceType')
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)

  const where: any = {}
  if (status) where.status = status
  if (serviceType) where.serviceType = serviceType
  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      include: {
        serviceCategory: true,
        customer: { select: { id: true, fullName: true, email: true, phone: true } },
        driver: { include: { user: { select: { fullName: true, phone: true } } } },
        events: { orderBy: { createdAt: 'asc' }, take: 20 },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.order.count({ where })
  ])
  return NextResponse.json({ orders, total, page, pageSize })
}

export async function PATCH(req: Request) {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const body = await req.json()
  const { id, status, cancelReason } = body
  if (!id || !status) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const order = await db.order.findUnique({ where: { id } })
  if (!order) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  const updated = await db.order.update({
    where: { id },
    data: {
      status,
      ...(status.startsWith('CANCELLED') ? {
        cancelledAt: new Date(),
        cancelledBy: 'ADMIN',
        cancelReason: cancelReason || 'Administrative action'
      } : {})
    }
  })
  await db.orderEvent.create({
    data: {
      orderId: id,
      eventType: status,
      fromStatus: order.status,
      toStatus: status,
      actorId: user.id,
      actorType: 'ADMIN',
    }
  })
  await db.auditLog.create({
    data: {
      actorId: user.id, actorType: 'ADMIN',
      action: 'ORDER_STATUS_CHANGE',
      resourceType: 'ORDER', resourceId: id,
      metadataJson: JSON.stringify({ from: order.status, to: status })
    }
  })
  return NextResponse.json({ order: updated })
}
