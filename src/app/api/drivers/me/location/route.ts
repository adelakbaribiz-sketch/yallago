import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user || user.role !== 'DRIVER' || !user.driverId) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const { latitude, longitude, heading, speed, accuracy } = body
  if (latitude == null || longitude == null) {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  }

  const existing = await db.driverLocation.findFirst({
    where: { driverId: user.driverId },
    orderBy: { createdAt: 'desc' }
  })
  if (existing) {
    await db.driverLocation.update({
      where: { id: existing.id },
      data: {
        latitude, longitude,
        heading, speed, accuracy,
        lastSeenAt: new Date(),
      }
    })
  } else {
    await db.driverLocation.create({
      data: {
        driverId: user.driverId,
        latitude, longitude,
        heading, speed, accuracy,
        isOnline: true,
        lastSeenAt: new Date(),
      }
    })
  }
  return NextResponse.json({ ok: true })
}
