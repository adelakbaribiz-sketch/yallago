import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { transitionOrder } from '@/lib/dispatch'

async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const order = await db.order.findUnique({
    where: { id },
    include: {
      serviceCategory: true,
      customer: { select: { id: true, fullName: true, email: true, phone: true } },
      driver: { include: { user: { select: { id: true, fullName: true, phone: true } }, vehicles: true } },
      events: { orderBy: { createdAt: 'asc' } },
      ratings: true,
      payments: true,
    }
  })
  if (!order) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  if (user.role === 'CUSTOMER' && order.customerId !== user.id) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }
  if (user.role === 'DRIVER' && order.driverId !== user.driverId) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }
  let driverLocation: { lat: number; lng: number; isOnline: boolean; lastSeenAt: string } | null = null
  if (order.driverId) {
    const loc = await db.driverLocation.findFirst({
      where: { driverId: order.driverId },
      orderBy: { createdAt: 'desc' }
    })
    if (loc) {
      driverLocation = {
        lat: loc.latitude, lng: loc.longitude,
        isOnline: loc.isOnline,
        lastSeenAt: loc.lastSeenAt.toISOString()
      }
    }
  }
  return NextResponse.json({ order, driverLocation })
}

async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { toStatus, cancelReason } = body
  if (!toStatus) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const order = await db.order.findUnique({ where: { id } })
  if (!order) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  if (user.role === 'CUSTOMER' && order.customerId !== user.id) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }
  if (user.role === 'DRIVER' && order.driverId !== user.driverId) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }
  try {
    const result = await transitionOrder(id, toStatus, {
      id: user.id,
      type: user.role as 'CUSTOMER' | 'DRIVER' | 'ADMIN'
    })
    if (cancelReason) {
      await db.order.update({ where: { id }, data: { cancelReason } })
    }
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export { GET, PUT }
