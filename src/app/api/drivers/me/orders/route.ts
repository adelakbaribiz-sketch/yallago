import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  const user = await getSessionUser()
  if (!user || user.role !== 'DRIVER' || !user.driverId) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }
  const orders = await db.order.findMany({
    where: { driverId: user.driverId },
    include: {
      serviceCategory: true,
      customer: { select: { id: true, fullName: true, phone: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return NextResponse.json({ orders })
}
