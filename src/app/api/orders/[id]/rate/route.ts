import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const { stars, comment, tags } = body
  if (!stars || stars < 1 || stars > 5) {
    return NextResponse.json({ error: 'INVALID_RATING' }, { status: 400 })
  }
  const order = await db.order.findUnique({ where: { id } })
  if (!order) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  if (order.status !== 'COMPLETED') {
    return NextResponse.json({ error: 'ORDER_NOT_COMPLETED' }, { status: 400 })
  }
  // Customer rates driver; Driver rates customer
  const rateeId = user.role === 'CUSTOMER' ? order.driverId : order.customerId
  if (!rateeId) return NextResponse.json({ error: 'NO_RATEGEE' }, { status: 400 })
  if (user.role === 'CUSTOMER' && order.customerId !== user.id) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }
  // Prevent duplicate ratings
  const existing = await db.rating.findUnique({
    where: { orderId_raterId: { orderId: id, raterId: user.id } }
  })
  if (existing) return NextResponse.json({ error: 'ALREADY_RATED' }, { status: 400 })

  const rating = await db.rating.create({
    data: {
      orderId: id,
      raterId: user.id,
      rateeId,
      rateeRole: user.role === 'CUSTOMER' ? 'DRIVER' : 'CUSTOMER',
      stars,
      comment,
      tagsJson: tags ? JSON.stringify(tags) : null,
    }
  })
  // Update driver aggregate rating
  if (user.role === 'CUSTOMER' && order.driverId) {
    const driver = await db.driver.findUnique({ where: { id: order.driverId } })
    if (driver) {
      const newTotal = driver.totalRatings + 1
      const newRating = (driver.rating * driver.totalRatings + stars) / newTotal
      await db.driver.update({
        where: { id: driver.id },
        data: { rating: newRating, totalRatings: newTotal }
      })
    }
  }
  return NextResponse.json({ rating })
}
